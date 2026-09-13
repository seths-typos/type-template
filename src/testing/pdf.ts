import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';

/**
 * The page's content stream as readable PDF operators.
 *
 * pdf-lib flate-compresses content streams, so asserting on the raw file
 * bytes finds nothing — inflate first.
 */
export async function contentStream(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(0).node.Contents();

  if (!contents) return '';

  const streams = (
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : [contents]
  ).filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream);

  return streams
    .map((stream) => Buffer.from(inflateSync(Buffer.from(stream.contents))).toString('latin1'))
    .join('\n');
}

/** How many paths the page actually strokes. */
export function strokeCount(content: string): number {
  return content.split('\n').filter((op) => op.trim() === 'S').length;
}

/**
 * The strings the page actually shows. pdf-lib writes them as hex strings,
 * so `<5479...> Tj` comes back as readable text.
 */
export function textShown(content: string): string[] {
  return [...content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map(([, hex]) =>
    Buffer.from(hex!, 'hex').toString('latin1'),
  );
}
