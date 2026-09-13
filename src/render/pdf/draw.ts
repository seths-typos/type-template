import type { LineStyle, SheetConfig } from '../../config/types.js';
import type { LineType, Sheet } from '../../geometry/types.js';
import { parseHexColor, type Rgb } from './color.js';

/**
 * Geometry output turned into draw operations, in PDF coordinates.
 *
 * This is where the y-axis flip happens: geometry hands us a top-left origin
 * with y running down, PDF wants bottom-left with y running up.
 *
 * Kept as plain data so the layout decisions are testable without producing
 * a PDF. `index.ts` is the only thing that touches pdf-lib.
 */

export interface DrawLine {
  kind: 'line';
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  color: Rgb;
  dash: number[] | null;
  /** The geometry line this came from — carried through for debugging. */
  source: LineType;
}

export interface DrawText {
  kind: 'text';
  text: string;
  x: number;
  /** PDF baseline of this line of text. */
  y: number;
  size: number;
  color: Rgb;
}

export type DrawOp = DrawLine | DrawText;

/**
 * Header typography. Not in the config schema yet — the schema gives the
 * header a height and free text but no font, size or colour.
 */
export interface HeaderTextStyle {
  size: number;
  color: string;
  /** Baseline-to-baseline distance for multi-line header text. */
  lineHeight: number;
}

export const DEFAULT_HEADER_TEXT_STYLE: HeaderTextStyle = {
  size: 12,
  color: '#000000',
  lineHeight: 14.4,
};

export interface DrawOptions {
  header?: Partial<HeaderTextStyle>;
}

export function drawOps(sheet: Sheet, config: SheetConfig, options: DrawOptions = {}): DrawOp[] {
  const flip = (y: number) => sheet.page.height - y;
  const ops: DrawOp[] = [];

  for (const row of sheet.rows) {
    for (const line of row.lines) {
      const style = styleFor(line.type, config);

      // Visibility is the renderer's call — geometry emits every line.
      if (!style.visible) continue;

      ops.push({
        kind: 'line',
        start: { x: line.start.x, y: flip(line.start.y) },
        end: { x: line.end.x, y: flip(line.end.y) },
        thickness: style.weight,
        color: parseHexColor(style.color),
        dash: style.dash,
        source: line.type,
      });
    }
  }

  ops.push(...headerOps(sheet, flip, { ...DEFAULT_HEADER_TEXT_STYLE, ...options.header }));

  return ops;
}

/** The line type doubles as the style key. */
function styleFor(type: LineType, config: SheetConfig): LineStyle {
  return type === 'slant' ? config.slant.style : config.lines[type];
}

/**
 * Header text, top-aligned in the reserved block, one op per line.
 *
 * Text longer than the block is drawn anyway rather than silently dropped —
 * overflow is config's problem to catch, not something to hide here.
 */
function headerOps(sheet: Sheet, flip: (y: number) => number, style: HeaderTextStyle): DrawText[] {
  const { header } = sheet;

  if (!header || header.text === '') return [];

  const color = parseHexColor(style.color);

  return header.text.split('\n').map((text, index) => ({
    kind: 'text' as const,
    text,
    x: header.x,
    // First baseline sits one font size below the top of the block.
    y: flip(header.y + style.size + index * style.lineHeight),
    size: style.size,
    color,
  }));
}
