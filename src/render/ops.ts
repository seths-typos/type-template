import { METRIC_LABELS } from '../config/labels.js';
import type { LineStyle, SheetConfig } from '../config/types.js';
import type { LineType, MetricLine, Sheet } from '../geometry/types.js';
import { parseHexColor, type Rgb } from './color.js';

/**
 * Geometry output turned into draw operations, shared by every renderer.
 *
 * Ops stay in **geometry space** — top-left origin, y running down. That is
 * canvas's native space, and the PDF renderer flips as it draws. Style
 * resolution, visibility, labels and header placement live here once rather
 * than once per renderer.
 *
 * Plain data, so the layout decisions are testable without producing
 * anything. Nothing here knows about pdf-lib or a canvas.
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
  y: number;
  size: number;
  color: Rgb;
  /** What `x` is: the text's left edge, its centre, or its right edge. */
  align: 'left' | 'center' | 'right';
  /**
   * What `y` is: the text's own baseline, or the vertical centre of its
   * capitals. Resolving 'center' needs font metrics, so each renderer does it
   * with its own — this stays measurement-free.
   */
  anchor: 'baseline' | 'center';
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

/** What each metric line's label says, by line. Lines left out go unlabelled. */
export type LabelText = Partial<Record<MetricLine, string>>;

export interface DrawOptions {
  header?: Partial<HeaderTextStyle>;
  /**
   * Label text for each row, by row index, in place of the fixed letters —
   * a front end naming each line's own value, say, which can differ row to
   * row. A row missing from the list gets no labels.
   */
  labelText?: LabelText[];
}

export function drawOps(sheet: Sheet, config: SheetConfig, options: DrawOptions = {}): DrawOp[] {
  const ops: DrawOp[] = [];

  for (const row of sheet.rows) {
    for (const line of row.lines) {
      const style = styleFor(line.type, config);

      // Visibility is the renderer's call — geometry emits every line.
      if (!style.visible) continue;

      ops.push({
        kind: 'line',
        start: { x: line.start.x, y: line.start.y },
        end: { x: line.end.x, y: line.end.y },
        thickness: style.weight,
        color: parseHexColor(style.color),
        dash: style.dash,
        source: line.type,
      });
    }
  }

  ops.push(...labelOps(sheet, config, options.labelText));
  ops.push(...headerOps(sheet, { ...DEFAULT_HEADER_TEXT_STYLE, ...options.header }));

  return ops;
}

/** The line type doubles as the style key. */
function styleFor(type: LineType, config: SheetConfig): LineStyle {
  return type === 'slant' ? config.slant.style : config.lines[type];
}

/**
 * Header text, top-aligned in the reserved block: the left text at its left
 * edge, the centre text on its centre, the right text at its right edge. One
 * op per line, the three sharing baselines.
 *
 * Text longer than the block is drawn anyway rather than silently dropped —
 * overflow is config's problem to catch, not something to hide here.
 */
function headerOps(sheet: Sheet, style: HeaderTextStyle): DrawText[] {
  const { header } = sheet;

  if (!header) return [];

  const color = parseHexColor(style.color);
  const slots = [
    { text: header.left, x: header.x, align: 'left' },
    { text: header.center, x: header.x + header.width / 2, align: 'center' },
    { text: header.right, x: header.x + header.width, align: 'right' },
  ] as const;

  return slots.flatMap(({ text, x, align }) =>
    text === ''
      ? []
      : text.split('\n').map((line, index) => ({
          kind: 'text' as const,
          text: line,
          x,
          // First baseline sits one font size below the top of the block.
          y: header.y + style.size + index * style.lineHeight,
          size: style.size,
          color,
          align,
          anchor: 'baseline' as const,
        })),
  );
}

/**
 * Metric line labels, set in the left margin and centred on their line.
 *
 * A line nobody draws gets no label, so switching a guide off takes its
 * letter with it. The letters are `METRIC_LABELS` unless `labelText` says
 * otherwise, row by row.
 */
function labelOps(sheet: Sheet, config: SheetConfig, labelText?: LabelText[]): DrawText[] {
  const { labels } = config;

  if (!labels.enabled) return [];

  const color = parseHexColor(labels.color);
  const ops: DrawText[] = [];

  sheet.rows.forEach((row, index) => {
    const texts = labelText ? (labelText[index] ?? {}) : METRIC_LABELS;

    for (const line of row.lines) {
      if (line.type === 'slant') continue;

      const text = texts[line.type];

      if (!text || !config.lines[line.type].visible) continue;

      ops.push({
        kind: 'text',
        text,
        x: line.start.x - labels.gap,
        y: line.start.y,
        size: labels.size,
        color,
        align: 'right',
        anchor: 'center',
      });
    }
  });

  return ops;
}
