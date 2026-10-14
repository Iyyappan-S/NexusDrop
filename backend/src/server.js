import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Server } from 'socket.io';
import { closeDatabase, connectDatabase, isDatabaseEnabled, recordFileOffer, updateTransferState } from './database.js';

const PORT = Number(process.env.PORT ?? 3001);
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim());
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS || 60 * 60 * 1000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 1000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
if (!origins.length || origins.some(origin => { try { const u = new URL(origin); return !['http:', 'https:'].includes(u.protocol) || u.origin !== origin; } catch { return true; } })) throw new Error('ALLOWED_ORIGINS must be a comma-separated list of exact HTTP(S) origins.');
if (!Number.isSafeInteger(ROOM_TTL_MS) || ROOM_TTL_MS < 60_000) throw new Error('ROOM_TTL_MS must be an integer of at least 60000.');
if (!Number.isSafeInteger(MAX_ROOMS) || MAX_ROOMS < 1 || MAX_ROOMS > 100_000) throw new Error('MAX_ROOMS must be an integer from 1 to 100000.');
const rooms = new Map();
const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/status', (_req, res) => res.json({ ok: true, activeRooms: rooms.size, maxRooms: MAX_ROOMS, fileStorage: false, metadataDatabase: isDatabaseEnabled() }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins, methods: ['GET', 'POST'] }, maxHttpBufferSize: 64 * 1024, pingInterval: 25000, pingTimeout: 20000 });
const idPattern = /^[A-Za-z0-9_-]{20,64}$/;
const tokenPattern = /^[A-Za-z0-9_-]{40,64}$/;
const safeEqual = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; return timingSafeEqual(Buffer.from(a), Buffer.from(b)); };
const expire = () => { const now = Date.now(); for (const [id, room] of rooms) if (room.expiresAt <= now) { io.to(id).emit('room:expired'); rooms.delete(id); } };
const cleanupTimer = setInterval(expire, 60_000).unref();
const validData = (d, max = 8192) => d && typeof d === 'object' && !Array.isArray(d) && JSON.stringify(d).length <= max;
const error = (socket, code, message) => socket.emit('error:protocol', { code, message });

io.on('connection', socket => {
  let membership = null;
  let createTimes = socket.data.createTimes || (socket.data.createTimes = []);
  const rate = () => { const now = Date.now(); createTimes = createTimes.filter(t => now - t < 60_000); socket.data.createTimes = createTimes; if (createTimes.length >= 8) return false; createTimes.push(now); return true; };
  socket.on('room:create', ack => {
    if (typeof ack !== 'function') return;
    if (!rate()) return ack({ ok: false, code: 'RATE_LIMIT' });
    if (rooms.size >= MAX_ROOMS) return ack({ ok: false, code: 'CAPACITY' });
    const id = randomBytes(18).toString('base64url');
    const senderToken = randomBytes(32).toString('base64url');
    const receiverToken = randomBytes(32).toString('base64url');
    const room = { sender: socket.id, senderToken, receiverToken, receiver: null, accepted: false, transferId: null, expiresAt: Date.now() + ROOM_TTL_MS, createdAt: Date.now() };
    rooms.set(id, room); membership = { id, role: 'sender' }; socket.join(id);
    ack({ ok: true, roomId: id, token: senderToken, inviteToken: receiverToken, expiresAt: room.expiresAt });
  });
  socket.on('room:join', (payload, ack) => {
    if (typeof ack !== 'function') return;
    if (!rate()) return ack({ ok: false, code: 'RATE_LIMIT' });
    if (!payload || !idPattern.test(payload.roomId || '')) return ack({ ok: false, code: 'INVALID_ROOM' });
    const room = rooms.get(payload.roomId);
    if (!room || room.expiresAt <= Date.now()) return ack({ ok: false, code: 'NOT_FOUND' });
    if (membership || room.receiver || room.sender === socket.id) return ack({ ok: false, code: 'ROOM_FULL' });
    if (!tokenPattern.test(payload.token || '') || !safeEqual(payload.token, room.receiverToken)) return ack({ ok: false, code: 'UNAUTHORIZED' });
    room.receiver = socket.id; membership = { id: payload.roomId, role: 'receiver' }; socket.join(payload.roomId);
    io.to(room.sender).emit('room:participant', { role: 'receiver', state: 'joined' });
    ack({ ok: true, role: 'receiver', expiresAt: room.expiresAt });
  });
  const authenticated = (payload, role) => {
    if (!membership || !payload || !idPattern.test(payload.roomId || '') || membership.id !== payload.roomId) return null;
    const room = rooms.get(membership.id);
    if (!room || !safeEqual(payload.token || '', room[membership.role + 'Token'])) return null;
    if (role && membership.role !== role) return null;
    return room;
  };
  socket.on('receiver:credential', (payload, ack) => {
    if (typeof ack !== 'function') return;
    if (membership?.role !== 'sender') return ack({ ok: false });
    const room = authenticated(payload, 'sender');
    if (!room || !room.receiver) return ack({ ok: false });
    ack({ ok: true, token: room.receiverToken });
  });
  socket.on('receiver:decision', payload => {
    const room = authenticated(payload, 'receiver');
    if (!room || typeof payload.accept !== 'boolean') return error(socket, 'UNAUTHORIZED', 'Invalid room authorization or decision.');
    room.accepted = payload.accept;
    if (room.transferId) updateTransferState({ transferId: room.transferId, state: payload.accept ? 'accepted' : 'declined' }).catch(() => console.error('NexusDrop metadata persistence failed: decision update.'));
    io.to(room.sender).emit('receiver:decision', { accepted: payload.accept });
  });
  socket.on('file:offer', async payload => {
    const room = authenticated(payload, 'sender');
    if (!room || !room.receiver || typeof payload.name !== 'string' || payload.name.length > 255 || !Number.isSafeInteger(payload.size) || payload.size < 0 || payload.size > 50 * 1024 ** 3 || typeof payload.mime !== 'string' || payload.mime.length > 127 || typeof payload.transferId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.transferId)) return error(socket, 'INVALID_METADATA', 'File metadata is invalid or receiver is not present.');
    room.transferId = payload.transferId;
    try { await recordFileOffer({ transferId: payload.transferId, sizeBytes: payload.size }); }
    catch { console.error('NexusDrop metadata persistence failed: file offer.'); }
    io.to(room.receiver).emit('file:offer', { transferId: payload.transferId, name: payload.name, size: payload.size, mime: payload.mime });
  });
  const signalingEvents = ['webrtc:offer', 'webrtc:answer', 'webrtc:ice', 'transfer:state'];
  for (const event of signalingEvents) socket.on(event, payload => {
    const room = authenticated(payload);
    if (!room || !room.receiver || !room.accepted) return error(socket, 'UNAUTHORIZED', 'Signaling is not authorized.');
    if (!validData(payload, event === 'webrtc:ice' ? 4096 : 32_768)) return error(socket, 'INVALID_PAYLOAD', 'Invalid or oversized signaling payload.');
    if (event === 'transfer:state') {
      if (membership.role !== 'sender' || payload.transferId !== room.transferId || payload.state !== 'completed' || !Number.isSafeInteger(payload.durationMs) || payload.durationMs < 0 || !Number.isSafeInteger(payload.averageBps) || payload.averageBps < 0) return error(socket, 'INVALID_STATE', 'Invalid transfer result metadata.');
      updateTransferState({ transferId: payload.transferId, state: payload.state, durationMs: payload.durationMs, averageBps: payload.averageBps }).catch(() => console.error('NexusDrop metadata persistence failed: result update.'));
    }
    const target = membership.role === 'sender' ? room.receiver : room.sender;
    const { roomId, token, ...message } = payload;
    io.to(target).emit(event, message);
  });
  socket.on('disconnect', () => {
    if (!membership) return;
    const { id, role } = membership; const room = rooms.get(id); if (!room) return;
    if (role === 'sender') { rooms.delete(id); io.to(id).emit('room:participant', { role, state: 'disconnected' }); }
    else { room.receiver = null; room.accepted = false; io.to(room.sender).emit('room:participant', { role, state: 'disconnected' }); }
  });
});

const listen = () => server.listen(PORT, '0.0.0.0', () => console.log(`NexusDrop signaling listening on ${PORT}`));
if (process.env.MONGODB_URI?.trim()) connectDatabase().then(listen).catch(() => { console.error('NexusDrop could not connect to MongoDB; check URI, network access, and credentials.'); process.exit(1); });
else listen();
const shutdown = () => { clearInterval(cleanupTimer); io.close(async () => { try { await closeDatabase(); } catch { console.error('NexusDrop metadata database shutdown failed.'); } process.exit(0); }); setTimeout(() => process.exit(1), 5000).unref(); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
export { app, server, io, rooms };
