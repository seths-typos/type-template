import { bandExtremes, metricOffsets, slantLines } from '../src/index.js';
import type { LineSegment, LineStyle, MetricLine, SheetConfig } from '../src/index.js';

/**
 * The row preview card in the row metric editor: one row band, magnified.
 * Lines run edge to edge, unlabelled.
 *
 * Sizes are CSS pixels from the Figma "Active" frame (node 292:1547). The card
 * shows the left end of a row only — lines run off its right edge. Its width
 * is set by whoever places it, matched to its controls; this is the fallback.
 */
export const CARD = { width: 90, height: 176 };

/**
 * The row band always fills this span, whatever the metrics. On the sheet
 * every row band is the same height, so the card scales to match. Half-pixel
 * values keep 1 px lines crisp. Centred in the card, with 29.5 px of card
 * above and below.
 */
export const BAND = { top: 29.5, bottom: 146.5 };

const ORDER: MetricLine[] = ['ascender', 'capHeight', 'xHeight', 'baseline', 'descender'];

export type RowPreviewConfig = Pick<SheetConfig, 'metrics' | 'lines' | 'slant'>;

export interface PreviewLine {
  type: MetricLine;
  /** px from the card's top edge */
  y: number;
  style: LineStyle;
}

export interface RowPreviewLayout {
  lines: PreviewLine[];
  slants: LineSegment[];
}

/**
 * Where everything sits in a card `width` px wide inside its border. Pure, so
 * it is testable without a DOM.
 */
export function rowPreviewLayout(
  config: RowPreviewConfig,
  width: number = CARD.width,
): RowPreviewLayout {
  const { metrics, lines, slant } = config;
  const band = bandExtremes(metrics);
  /** Card px per percent of cap height. */
  const scale = (BAND.bottom - BAND.top) / (band.top - band.bottom);
  const baseline = BAND.top + band.top * scale;
  // Offsets in percent of cap height: a cap height of 100 makes them so.
  const offsets = metricOffsets(100, metrics);

  const visible = ORDER.filter((type) => lines[type].visible).map((type) => ({
    type,
    y: baseline - offsets[type] * scale,
    style: lines[type],
  }));

  // Slant spacing is in points on the sheet; one percent of cap height is
  // capHeight / 100 pt, so this is the same magnification the band gets.
  const pxPerPt = (scale * 100) / metrics.capHeight;
  const spacing = slant.spacing * pxPerPt;
  // One slant line starts at the left end of the lowest metric line. Lines
  // are anchored on the baseline, so step back along the slant from the
  // band's bottom-left corner to find where it crosses. Start one spacing
  // further left still, so the card also shows a line entering from the left
  // edge — the mirror of the one leaving on the right.
  const corner = (BAND.bottom - baseline) * Math.tan((slant.angle * Math.PI) / 180);
  const inset = corner - spacing;
  const slants = slant.enabled
    ? slantLines(
        {
          index: 0,
          top: BAND.top,
          baseline,
          bottom: BAND.bottom,
          left: 0,
          right: width,
          lines: [],
        },
        { ...slant, spacing, inset },
      )
    : [];

  return { lines: visible, slants: slant.style.visible ? slants : [] };
}

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  return el;
}

/**
 * Preview lines are drawn 2 px per printed point, so the engine's 0.5 pt is
 * 1 px and the heaviest, 1.5 pt, is 3: legible at card size without scaling
 * with it. Colour and dash come from the config; the dash is read in px.
 */
const PX_PER_PT = 2;

function stroke(style: LineStyle): Record<string, string | number> {
  return {
    stroke: style.color,
    'stroke-width': style.weight * PX_PER_PT,
    ...(style.dash ? { 'stroke-dasharray': style.dash.join(' ') } : {}),
  };
}

/** `row` is 1-based, as the user counts them; `width` is the card's. */
export function renderRowPreview(
  config: RowPreviewConfig,
  row: number,
  width: number = CARD.width,
): HTMLElement {
  const { lines, slants } = rowPreviewLayout(config, width);

  const section = document.createElement('section');
  section.className = 'row-editor';

  const title = document.createElement('h3');
  title.className = 'heading-h3 row-editor-title frame-title';
  title.textContent = `Row ${row}`;

  const card = document.createElement('div');
  card.className = 'row-preview';
  card.style.width = `${width}px`;
  card.style.height = `${CARD.height}px`;

  const root = svg('svg', {
    width,
    height: CARD.height,
    viewBox: `0 0 ${width} ${CARD.height}`,
  });

  for (const line of lines) {
    root.append(
      svg('line', { x1: 0, y1: line.y, x2: width, y2: line.y, ...stroke(line.style) }),
    );
  }

  // Slant draws over the metric lines, as in the design.
  for (const { start, end } of slants) {
    root.append(
      svg('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, ...stroke(config.slant.style) }),
    );
  }

  card.append(root);
  section.append(title, card);
  return section;
}
