import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB_NAME || 'nexusdrop';
const retentionDays = Number(process.env.METADATA_RETENTION_DAYS || 30);
let client = null;
let transfers = null;

if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
  throw new Error('METADATA_RETENTION_DAYS must be an integer from 1 to 3650.');
}
if (!/^[A-Za-z0-9_-]{1,63}$/.test(dbName)) throw new Error('MONGODB_DB_NAME must use 1-63 letters, digits, underscores, or hyphens.');

export async function connectDatabase() {
  if (!uri) return false;
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://.');
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, appName: 'NexusDrop' });
  await client.connect();
  const db = client.db(dbName);
  transfers = db.collection('transfer_metadata');
  await transfers.createIndex({ transferId: 1 }, { unique: true });
  await transfers.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await transfers.createIndex({ createdAt: -1 });
  return true;
}

export function isDatabaseEnabled() { return Boolean(transfers); }

// Intentionally persist aggregate transfer metadata only: no contents, filename, MIME, IP, room ID, or tokens.
export async function recordFileOffer({ transferId, sizeBytes }) {
  if (typeof transferId !== 'string' || !/^[0-9a-f-]{36}$/i.test(transferId) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 50 * 1024 ** 3) {
    throw new TypeError('Invalid transfer metadata.');
  }
  if (!transfers) return false;
  const now = new Date();
  await transfers.updateOne({ transferId }, {
    $setOnInsert: {
      transferId,
      sizeBytes,
      state: 'offered',
      createdAt: now,
      expiresAt: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000)
    }
  }, { upsert: true });
  return true;
}

export async function updateTransferState({ transferId, state, durationMs, averageBps }) {
  if (typeof transferId !== 'string' || !/^[0-9a-f-]{36}$/i.test(transferId) || !['accepted', 'declined', 'completed', 'failed', 'cancelled'].includes(state)) {
    throw new TypeError('Invalid transfer state update.');
  }
  const fields = { state, updatedAt: new Date() };
  if (state === 'completed') {
    if (!Number.isSafeInteger(durationMs) || durationMs < 0 || !Number.isSafeInteger(averageBps) || averageBps < 0) throw new TypeError('Invalid transfer metrics.');
    fields.durationMs = durationMs;
    fields.averageBps = averageBps;
    fields.completedAt = new Date();
  }
  if (!transfers) return false;
  await transfers.updateOne({ transferId }, { $set: fields });
  return true;
}

export async function closeDatabase() {
  transfers = null;
  if (client) await client.close();
  client = null;
}
