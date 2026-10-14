import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as client } from 'socket.io-client';
process.env.PORT = '0';
process.env.MONGODB_URI = '';
const { server, io: serverIo, rooms } = await import('../src/server.js');
let base;
const connect = () => new Promise((resolve, reject) => {
  const s = client(base, { transports: ['websocket'], reconnection: false, timeout: 3000 });
  s.once('connect', () => resolve(s)); s.once('connect_error', reject);
});
const emitAck = (s, event, payload) => new Promise(resolve => payload === undefined ? s.emit(event, resolve) : s.emit(event, payload, resolve));

before(async () => { await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { for (const s of serverIo.sockets.sockets.values()) s.disconnect(true); rooms.clear(); await new Promise(resolve => serverIo.close(resolve)); });

test('health and status endpoints are operational without exposing secrets', async () => {
  const health = await fetch(`${base}/health`); assert.equal(health.status, 200); assert.deepEqual(await health.json(), { ok: true });
  const status = await (await fetch(`${base}/api/status`)).json(); assert.equal(status.ok, true); assert.equal(status.fileStorage, false); assert.equal(status.metadataDatabase, false); assert.equal(JSON.stringify(status).includes('Token'), false);
});

test('room invite authorizes one receiver; rejects bad token, duplicate receiver and unauthenticated signaling', async () => {
  const sender = await connect();
  const created = await emitAck(sender, 'room:create'); assert.equal(created.ok, true); assert.ok(created.roomId); assert.ok(created.token); assert.ok(created.inviteToken);
  const stranger = await connect();
  const bad = await emitAck(stranger, 'room:join', { roomId: created.roomId, token: 'invalid' }); assert.equal(bad.ok, false); assert.equal(bad.code, 'UNAUTHORIZED');
  const receiver = await connect();
  const joined = await emitAck(receiver, 'room:join', { roomId: created.roomId, token: created.inviteToken }); assert.equal(joined.ok, true);
  const transferId = '123e4567-e89b-42d3-a456-426614174000';
  const offered = new Promise(resolve => receiver.once('file:offer', resolve));
  sender.emit('file:offer', { roomId: created.roomId, token: created.token, transferId, name: 'sample.bin', size: 1024, mime: 'application/octet-stream' });
  assert.deepEqual(await offered, { transferId, name: 'sample.bin', size: 1024, mime: 'application/octet-stream' });
  const extra = await connect(); const duplicate = await emitAck(extra, 'room:join', { roomId: created.roomId, token: created.inviteToken }); assert.equal(duplicate.ok, false);
  const signaling = new Promise(resolve => sender.once('webrtc:offer', resolve));
  receiver.emit('receiver:decision', { roomId: created.roomId, token: created.inviteToken, accept: true });
  await new Promise(r => setTimeout(r, 20));
  receiver.emit('webrtc:offer', { roomId: created.roomId, token: created.inviteToken, description: { type: 'offer', sdp: 'candidate-safe-test' } });
  assert.deepEqual(await signaling, { description: { type: 'offer', sdp: 'candidate-safe-test' } });
  const noRoom = await emitAck(stranger, 'room:join', { roomId: 'not-a-real-room-identifier', token: created.inviteToken }); assert.equal(noRoom.ok, false);
  sender.disconnect(); receiver.disconnect(); stranger.disconnect(); extra.disconnect();
});

test('invalid and oversized signaling payloads are rejected', async () => {
  const sender = await connect(); const c = await emitAck(sender, 'room:create'); const receiver = await connect();
  await emitAck(receiver, 'room:join', { roomId:c.roomId, token:c.inviteToken });
  receiver.emit('receiver:decision',{roomId:c.roomId,token:c.inviteToken,accept:true}); await new Promise(r=>setTimeout(r,10));
  const receivedError = new Promise(resolve=>receiver.once('error:protocol',resolve));
  receiver.emit('webrtc:offer',{roomId:c.roomId,token:c.inviteToken,description:{sdp:'x'.repeat(40_000)}});
  const error=await receivedError; assert.equal(error.code,'INVALID_PAYLOAD');
  sender.disconnect(); receiver.disconnect();
});
