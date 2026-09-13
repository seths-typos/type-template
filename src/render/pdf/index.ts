import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SheetConfig } from '../../config/types.js';
import type { Sheet } from '../../geometry/types.js';
import { drawOps, type DrawOp, type DrawOptions } from './draw.js';

export { DEFAULT_HEADER_TEXT_STYLE, drawOps } from './draw.js';
export type { DrawLine, DrawOp, DrawOptions, DrawText, HeaderTextStyle } from './draw.js';
export { parseHexColor } from './color.js';
export type { Rgb } from './color.js';

/**
 * Geometry output in, PDF bytes out.
 *
 * The only module that imports a PDF library. Owns page creation, the y-axis
 * flip (in `draw.ts`), stroke styling, dash patterns and header text.
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

  for (const op of ops) {
    draw(page, op, font);
  }

  return doc.save();
}

type Page = ReturnType<PDFDocument['addPage']>;
type Font = Awaited<ReturnType<PDFDocument['embedFont']>>;

function draw(page: Page, op: DrawOp, font: Font | undefined): void {
  if (op.kind === 'line') {
    page.drawLine({
      start: op.start,
      end: op.end,
      thickness: op.thickness,
      color: rgb(op.color.r, op.color.g, op.color.b),
      ...(op.dash ? { dashArray: op.dash } : {}),
    });
    return;
  }

  page.drawText(op.text, {
    x: op.x,
    y: op.y,
    size: op.size,
    font,
    color: rgb(op.color.r, op.color.g, op.color.b),
  });
}
