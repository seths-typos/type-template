import type { FontUnitMetrics, MetricLine } from '../src/index.js';

/**
 * The editor's ordering rules for font-unit metrics: ascender above the cap
 * height, x-height between the baseline (0) and the cap height, descender
 * below the baseline. The engine doesn't enforce order — its band adapts to
 * whatever it is given — so this is the UX asking for a well-formed face.
 *
 * A metric switched off isn't drawn, so its value isn't judged. The cap
 * height is, always: the others are measured against it. Pure, so it is
 * testable without a DOM.
 */
export function metricOrderErrors(
  units: FontUnitMetrics,
  visible: Record<MetricLine, boolean>,
): Map<string, string> {
  const errors = new Map<string, string>();
  const { ascender, capHeight, xHeight, descender } = units;

  if (visible.ascender && !(ascender > capHeight)) {
    errors.set('metrics.ascender', 'Must be above the cap height.');
  }
  if (visible.xHeight && !(xHeight > 0 && xHeight < capHeight)) {
    errors.set('metrics.xHeight', 'Must be between 0 and the cap height.');
  }
  if (visible.descender && !(descender < 0)) {
    errors.set('metrics.descender', 'Must be below 0.');
  }
  return errors;
}
