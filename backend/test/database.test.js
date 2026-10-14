import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.MONGODB_URI = '';
const db = await import('../src/database.js');
const id = '123e4567-e89b-42d3-a456-426614174000';

test('MongoDB is optional and metadata writes safely no-op when disabled', async () => {
  assert.equal(db.isDatabaseEnabled(), false);
  assert.equal(await db.recordFileOffer({ transferId: id, sizeBytes: 42 }), false);
  assert.equal(await db.updateTransferState({ transferId: id, state: 'completed', durationMs: 1000, averageBps: 42 }), false);
});

test('metadata input validation rejects invalid identifiers, sizes, states, and completion metrics', async () => {
  await assert.rejects(db.recordFileOffer({ transferId: 'room-secret', sizeBytes: 5 }), TypeError);
  await assert.rejects(db.recordFileOffer({ transferId: id, sizeBytes: -1 }), TypeError);
  await assert.rejects(db.updateTransferState({ transferId: id, state: 'room-token' }), TypeError);
  await assert.rejects(db.updateTransferState({ transferId: id, state: 'completed', durationMs: -1, averageBps: 0 }), TypeError);
});
