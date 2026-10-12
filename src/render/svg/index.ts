import { drawOps, type DrawOp, type DrawOptions } from '../ops.js';
import { toCss } from '../canvas/index.js';
import type { SheetConfig } from '../../config/types.js';
import type { Sheet } from '../../geometry/types.js';

/**
 * Geometry output as an SVG document.
 *
 * Sits beside `render/pdf/` and `render/canvas/`, consuming the same draw ops.
 * SVG is y-down like the ops, so nothing is flipped. The viewBox is the page
 * in points and the size is given in points too, so the browser lays it out
 * at true size — what printing from a page wants: vector lines, the sheet's
 * own dimensions.
 */

export interface SvgOptions extends DrawOptions {
  /** Paper colour behind the guides. */
  background?: string;
  /** Font family for header text and labels. */
  fontFamily?: string;
}

export function sheetToSvg(sheet: Sheet, config: SheetConfig, options: SvgOptions = {}): string {
  const { background = '#ffffff', fontFamily = 'Helvetica, Arial, sans-serif', ...drawOptions } =
    options;
  const { width, height } = sheet.page;

  const body = drawOps(sheet, config, drawOptions)
    .map((op) => element(op, fontFamily))
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${attr(background)}"/>` +
    body +
    `</svg>`
  );
}

function element(op: DrawOp, fontFamily: string): string {
  if (op.kind === 'line') {
    const dash = op.dash?.length ? ` stroke-dasharray="${op.dash.join(' ')}"` : '';
    return (
      `<line x1="${op.start.x}" y1="${op.start.y}" x2="${op.end.x}" y2="${op.end.y}" ` +
      `stroke="${toCss(op.color)}" stroke-width="${op.thickness}"${dash}/>`
    );
  }

  // 'central' centres on the em box where the PDF renderer centres on cap
  // height, as the canvas renderer does, so a label sits a hair differently.
  const baseline = op.anchor === 'center' ? ' dominant-baseline="central"' : '';
  const anchor = op.align === 'right' ? ' text-anchor="end"' : '';
  return (
    `<text x="${op.x}" y="${op.y}" font-size="${op.size}" font-family="${attr(fontFamily)}" ` +
    `fill="${toCss(op.color)}"${anchor}${baseline}>${text(op.text)}</text>`
  );
}

function text(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(value: string): string {
  return text(value).replace(/"/g, '&quot;');
}
