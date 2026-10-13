import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SheetConfig } from '../../config/types.js';
import type { Sheet } from '../../geometry/types.js';
import { drawOps, type DrawOp, type DrawOptions } from '../ops.js';

export { DEFAULT_HEADER_TEXT_STYLE, drawOps } from '../ops.js';
export type { DrawLine, DrawOp, DrawOptions, DrawText, HeaderTextStyle } from '../ops.js';
export { parseHexColor } from '../color.js';
export type { Rgb } from '../color.js';

/**
 * Geometry output in, PDF bytes out.
 *
 * The only module that imports a PDF library. Owns page creation, the y-axis
 * flip, and turning draw ops into pdf-lib calls.
 */
export async function renderSheetPdf(
  sheet: Sheet,
  config: SheetConfig,
  options: DrawOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([sheet.page.width, sheet.page.height]);
  const ops = drawOps(sheet, config, options);

  // Standard 14 font, so nothing is embedded unless the header needs it.
  const font = ops.some((op) => op.kind === 'text')
    ? await doc.embedFont(StandardFonts.Helvetica)
    : undefined;

  // Ops arrive in geometry space, top-left origin with y running down. PDF
  // measures up from the bottom-left, so this is where the flip happens.
  const flip = (y: number) => sheet.page.height - y;

  for (const op of ops) {
    draw(page, op, font, flip);
  }

  return doc.save();
}

type Page = ReturnType<PDFDocument['addPage']>;
type Font = Awaited<ReturnType<PDFDocument['embedFont']>>;

function draw(page: Page, op: DrawOp, font: Font | undefined, flip: (y: number) => number): void {
  if (op.kind === 'line') {
    page.drawLine({
      start: { x: op.start.x, y: flip(op.start.y) },
      end: { x: op.end.x, y: flip(op.end.y) },
      thickness: op.thickness,
      color: rgb(op.color.r, op.color.g, op.color.b),
      ...(op.dash ? { dashArray: op.dash } : {}),
    });
    return;
  }

  // Alignment is resolved here rather than in draw.ts because it needs the
  // font's metrics. A canvas renderer measures its own the same way.
  const width = font ? font.widthOfTextAtSize(op.text, op.size) : 0;
  const capHeight = font ? font.heightAtSize(op.size, { descender: false }) : op.size;

  page.drawText(op.text, {
    x: op.align === 'right' ? op.x - width : op.align === 'center' ? op.x - width / 2 : op.x,
    y: op.anchor === 'center' ? flip(op.y) - capHeight / 2 : flip(op.y),
    size: op.size,
    font,
    color: rgb(op.color.r, op.color.g, op.color.b),
  });
}
