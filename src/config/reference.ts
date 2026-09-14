import type { MetricsConfig } from './types.js';

/**
 * The isolation rule.
 *
 * Cap height is the reference metric: it is the one absolute value in points,
 * and every other vertical metric is a percentage of it. That choice lives
 * here and nowhere else.
 *
 * If user testing moves the reference — to total metric height, say — this
 * function converts the new input back into cap-height terms and nothing
 * downstream changes. Today it is close to a pass-through. The point is that
 * there is exactly one place to change.
 */
export interface ReferencedMetrics {
  /** pt, absolute */
  capHeight: number;
  /** % of cap height */
  xHeight: number;
  /** % of cap height */
  ascender: number;
  /** % of cap height, at or below 0 */
  descender: number;
}

export function toCapHeightReference(
  metrics: Pick<MetricsConfig, 'capHeight' | 'xHeight' | 'ascender' | 'descender'>,
): ReferencedMetrics {
  return {
    capHeight: metrics.capHeight,
    xHeight: metrics.xHeight,
    ascender: metrics.ascender,
    descender: metrics.descender,
  };
}
