import type { MetricsConfig, SlantConfig } from '../config/types.js';
import type { LineSegment, MetricLine, Rect, Row } from './types.js';
import { bandExtremes, metricOffsets } from './metrics.js';
import { slantLines } from './slant.js';

/** Top to bottom within a row band. */
const METRIC_ORDER: MetricLine[] = ['ascender', 'capHeight', 'xHeight', 'baseline', 'descender'];

export interface RowLayout {
  /** Resolved cap height in points. */
  capHeight: number;
  /** Ascender line to descender line. */
  totalMetricHeight: number;
  rowCount: number;
  /** y of the first row's ascender line. */
  blockTop: number;
  /** Descender line to the next ascender line. */
  gap: number;
}

/**
 * Lay out row bands and the line segments inside them.
 *
 * Every metric line is emitted regardless of its style's `visible` flag —
 * visibility is a rendering concern, and both renderers honour it themselves.
 */
export function buildRows(
  area: Rect,
  layout: RowLayout,
  metrics: Pick<MetricsConfig, 'xHeight' | 'ascender' | 'descender'>,
  slant: SlantConfig,
): Row[] {
  const offsets = metricOffsets(layout.capHeight, metrics);
  const pitch = layout.totalMetricHeight + layout.gap;
  const rows: Row[] = [];

  // The band follows whichever metrics are there, so its edges are not always
  // the ascender and descender.
  const band = bandExtremes(metrics);
  const bandTop = (layout.capHeight * band.top) / 100;
  const bandBottom = (layout.capHeight * band.bottom) / 100;

  for (let index = 0; index < layout.rowCount; index++) {
    const top = layout.blockTop + index * pitch;
    const baseline = top + bandTop;

    const row: Row = {
      index,
      top,
      baseline,
      bottom: baseline - bandBottom,
      left: area.left,
      right: area.right,
      lines: [],
    };

    row.lines = [...metricLines(row, offsets), ...slantLines(row, slant)];
    rows.push(row);
  }

  return rows;
}

/** The five horizontal lines, spanning the full available width. */
function metricLines(row: Row, offsets: Record<MetricLine, number>): LineSegment[] {
  return METRIC_ORDER.map((type) => {
    // Offsets run up from the baseline, page y runs down.
    const y = row.baseline - offsets[type];

    return {
      start: { x: row.left, y },
      end: { x: row.right, y },
      type,
    };
  });
}
