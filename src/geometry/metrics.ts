import type { MetricsConfig } from '../config/types.js';
import type { MetricLine } from './types.js';

/** Tolerance for fitting whole rows into an available height. */
const EPSILON = 1e-9;

/**
 * Each metric line's height above the baseline, in points. The baseline is the
 * reference at 0 and heights are measured upward, the way a font's metrics
 * read: x-height at 60% sits 60% of the cap height above the baseline, and a
 * negative descender sits below it.
 *
 * These are not page coordinates. Page space is top-left origin with y running
 * downward, so a caller placing a line subtracts: y = baseline - offset.
 *
 * Cap height is absolute; every other metric is capHeight x (percent / 100).
 */
export function metricOffsets(
  capHeight: number,
  metrics: Pick<MetricsConfig, 'xHeight' | 'ascender' | 'descender'>,
): Record<MetricLine, number> {
  const at = (percent: number) => capHeight * (percent / 100);

  return {
    ascender: at(metrics.ascender),
    capHeight: at(100),
    xHeight: at(metrics.xHeight),
    baseline: 0,
    descender: at(metrics.descender),
  };
}

/**
 * The span of one row band as a multiple of cap height:
 * (ascender - descender) / 100.
 */
export function metricHeightRatio(
  metrics: Pick<MetricsConfig, 'ascender' | 'descender'>,
): number {
  const ratio = (metrics.ascender - metrics.descender) / 100;

  if (!(ratio > 0)) {
    throw new Error(
      `Ascender (${metrics.ascender}%) must be above descender (${metrics.descender}%).`,
    );
  }

  return ratio;
}

/** Ascender line to descender line, in points. */
export function totalMetricHeight(
  capHeight: number,
  metrics: Pick<MetricsConfig, 'ascender' | 'descender'>,
): number {
  if (!(capHeight > 0)) {
    throw new Error(`Cap height must be greater than 0, got ${capHeight}.`);
  }

  return metricHeightRatio(metrics) * capHeight;
}

/** Total metric height + row gap. */
export function rowPitch(totalHeight: number, rowGap: number): number {
  return totalHeight + rowGap;
}

/**
 * How many whole rows fit in `availableHeight` at the given pitch.
 * Gaps sit between rows only — n rows occupy n x height + (n - 1) x gap.
 */
export function fitRowCount(availableHeight: number, totalHeight: number, rowGap: number): number {
  const pitch = rowPitch(totalHeight, rowGap);

  if (!(pitch > 0)) {
    throw new Error(`Row pitch must be greater than 0, got ${pitch}.`);
  }

  return Math.max(0, Math.floor((availableHeight + rowGap) / pitch + EPSILON));
}

/**
 * Solve for the cap height at which `rowCount` rows exactly fill
 * `availableHeight`. Row gap stays fixed.
 */
export function solveCapHeight(
  availableHeight: number,
  rowCount: number,
  rowGap: number,
  metrics: Pick<MetricsConfig, 'ascender' | 'descender'>,
): number {
  if (!Number.isInteger(rowCount) || rowCount < 1) {
    throw new Error(`Row count must be a positive integer, got ${rowCount}.`);
  }

  const ratio = metricHeightRatio(metrics);
  const heightForRows = availableHeight - (rowCount - 1) * rowGap;
  const capHeight = heightForRows / (rowCount * ratio);

  if (!(capHeight > 0)) {
    throw new Error(
      `${rowCount} rows with a ${rowGap} pt gap do not fit in ${availableHeight} pt.`,
    );
  }

  return capHeight;
}
