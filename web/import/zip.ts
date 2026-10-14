/** Whether these bytes start like a zip archive. */
export function isZip(bytes: ArrayBuffer): boolean {
  return bytes.byteLength >= 4 && new DataView(bytes).getUint32(0, true) === LOCAL_HEADER;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;

/**
 * The first file in a zip whose path `match` accepts, unpacked; null if
 * none does. Read through the central directory, whose sizes are right even
 * when an entry's local header leaves them to a trailing descriptor. Stored
 * and deflated entries only — all a zipped folder needs.
 *
 * Chrome on macOS sends a package — a .ufo or .glyphspackage the Finder
 * shows as one file — zipped, so this is how most of them arrive.
 */
export async function readZipEntry(
  bytes: ArrayBuffer,
  match: (path: string) => boolean,
): Promise<{ path: string; bytes: ArrayBuffer } | null> {
  const view = new DataView(bytes);
  const names = new TextDecoder();

  // The end record sits last, after a comment of up to 64 KB.
  let end = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END_OF_CENTRAL) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new RangeError('No zip directory.');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== CENTRAL_HEADER) throw new RangeError('Bad zip directory.');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const path = names.decode(new Uint8Array(bytes, at + 46, nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (!match(path)) continue;

    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = new Uint8Array(bytes.slice(start, start + size));
    if (method === 0) return { path, bytes: data.buffer };
    if (method !== 8) throw new RangeError(`Zip method ${method} isn't supported.`);
    const inflated = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return { path, bytes: await new Response(inflated).arrayBuffer() };
  }
  return null;
}
