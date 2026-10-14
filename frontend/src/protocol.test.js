import { describe, it, expect } from 'vitest';
import { encodeChunk, decodeChunk } from './protocol.js';

describe('NexusDrop chunk protocol', () => {
  it('round-trips binary bytes and the sequence header', () => {
    const bytes = new Uint8Array([0, 255, 14, 32, 128]);
    const frame = encodeChunk({ transferId: 't-1', seq: 4, offset: 4096 }, bytes);
    const decoded = decodeChunk(frame);
    expect(decoded.header).toMatchObject({ type: 'chunk', transferId: 't-1', seq: 4, offset: 4096, len: 5 });
    expect([...decoded.bytes]).toEqual([...bytes]);
  });
  it('rejects truncated frames and over-limit chunks', () => {
    expect(() => decodeChunk(new ArrayBuffer(2))).toThrow('Invalid data frame');
    expect(() => encodeChunk({ transferId: 't', seq: 0, offset: 0 }, new Uint8Array(256 * 1024 + 1))).toThrow('Chunk exceeds protocol limits');
  });
  it('rejects corrupt length metadata', () => {
    const frame = encodeChunk({ transferId: 't', seq: 0, offset: 0 }, new Uint8Array([1]));
    new DataView(frame).setUint32(0, 2048);
    expect(() => decodeChunk(frame)).toThrow('Invalid chunk header');
  });
});
