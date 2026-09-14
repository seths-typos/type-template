import { drawOps, type DrawOp, type DrawOptions } from '../ops.js';
import type { Rgb } from '../color.js';
import type { SheetConfig } from '../../config/types.js';
import type { Sheet } from '../../geometry/types.js';

/**
 * Geometry output onto a canvas.
 *
 * Sits beside `render/pdf/` consuming the same draw ops. Canvas already uses
 * a top-left origin with y running down, which is the space the ops are in,
 * so unlike the PDF renderer there is nothing to flip.
 */

/**
 * Only the parts of a 2D context this uses. A real CanvasRenderingContext2D
 * satisfies it, and a test can pass a recorder without a DOM.
 */
export interface Canvas2D {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  setLineDash(segments: number[]): void;
  // DOM types these wider than string. Accepting the union lets a real
  // context satisfy this interface while a test stub can still use strings.
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export interface CanvasOptions extends DrawOptions {
  /** Points per canvas pixel. 1 draws the sheet at its true size. */
  scale?: number;
  /** Paper colour behind the guides. */
  background?: string;
  /** Font family for header text and labels. */
  fontFamily?: string;
}

export function drawSheetToCanvas(
  ctx: Canvas2D,
  sheet: Sheet,
  config: SheetConfig,
  options: CanvasOptions = {},
): void {
  const { scale = 1, background = '#ffffff', fontFamily = 'sans-serif', ...drawOptions } = options;

  ctx.save();
  ctx.scale(scale, scale);

  ctx.clearRect(0, 0, sheet.page.width, sheet.page.height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, sheet.page.width, sheet.page.height);

  for (const op of drawOps(sheet, config, drawOptions)) {
    draw(ctx, op, fontFamily);
  }

  ctx.restore();
}

function draw(ctx: Canvas2D, op: DrawOp, fontFamily: string): void {
  if (op.kind === 'line') {
    ctx.strokeStyle = toCss(op.color);
    ctx.lineWidth = op.thickness;
    ctx.setLineDash(op.dash ?? []);

    ctx.beginPath();
    ctx.moveTo(op.start.x, op.start.y);
    ctx.lineTo(op.end.x, op.end.y);
    ctx.stroke();

    return;
  }

  ctx.fillStyle = toCss(op.color);
  ctx.font = `${op.size}px ${fontFamily}`;
  ctx.textAlign = op.align;
  // 'middle' centres on the em box where the PDF renderer centres on cap
  // height, so a label sits a hair differently on screen than on paper.
  ctx.textBaseline = op.anchor === 'center' ? 'middle' : 'alphabetic';
  ctx.fillText(op.text, op.x, op.y);
}

/** Ops carry 0–1 components; CSS wants 0–255. */
export function toCss({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(value * 255);

  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}
