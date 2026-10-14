export function encodeChunk({ transferId, seq, offset }, bytes) {
  const header = new TextEncoder().encode(JSON.stringify({ type: 'chunk', transferId, seq, offset, len: bytes.byteLength }));
  if (header.length > 1024 || bytes.byteLength > 256 * 1024) throw new RangeError('Chunk exceeds protocol limits');
  const frame = new Uint8Array(4 + header.length + bytes.byteLength);
  new DataView(frame.buffer).setUint32(0, header.length);
  frame.set(header, 4); frame.set(new Uint8Array(bytes), 4 + header.length);
  return frame.buffer;
}
export function decodeChunk(data) {
  if (!(data instanceof ArrayBuffer) || data.byteLength < 5) throw new TypeError('Invalid data frame');
  const hlen = new DataView(data).getUint32(0);
  if (hlen > 1024 || hlen + 4 > data.byteLength) throw new TypeError('Invalid chunk header');
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 4, hlen)));
  const bytes = new Uint8Array(data, 4 + hlen);
  if (header.type !== 'chunk' || header.len !== bytes.length || bytes.length > 256 * 1024) throw new TypeError('Invalid chunk payload');
  return { header, bytes };
}
