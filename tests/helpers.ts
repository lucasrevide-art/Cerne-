export function decodeWavHeader(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const s = (o: number) => String.fromCharCode(...b.subarray(o, o + 4));
  const dataBytes = v.getUint32(40, true);
  const samples = Array.from({ length: dataBytes / 2 }, (_, i) => v.getInt16(44 + i * 2, true));
  return {
    riff: s(0), wave: s(8), channels: v.getUint16(22, true), sampleRate: v.getUint32(24, true),
    bits: v.getUint16(34, true), dataBytes, samples,
  };
}
