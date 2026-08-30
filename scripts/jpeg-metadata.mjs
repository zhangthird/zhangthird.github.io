// Strip JPEG metadata without decoding the compressed image.
export function stripJpegMetadata(data) {
  if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error('Expected a JPEG image.');
  const parts = [data.subarray(0, 2)];
  let offset = 2;
  while (offset < data.length) {
    const start = offset;
    if (data[offset++] !== 0xff) throw new Error('Invalid JPEG marker.');
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    // Keep the entire compressed scan, including progressive scans, byte-for-byte.
    if (marker === 0xda || marker === 0xd9) {
      parts.push(data.subarray(start));
      return Buffer.concat(parts);
    }
    if (offset + 2 > data.length) throw new Error('Truncated JPEG segment.');
    const size = data.readUInt16BE(offset);
    if (size < 2 || offset + size > data.length) throw new Error('Invalid JPEG segment length.');
    // APP1: EXIF/XMP; APP13: IPTC/Photoshop metadata; COM: comments.
    // ICC profiles (APP2) and Adobe color information (APP14) remain unchanged.
    if (![0xe1, 0xed, 0xfe].includes(marker)) parts.push(data.subarray(start, offset + size));
    offset += size;
  }
  throw new Error('Missing JPEG image scan.');
}
