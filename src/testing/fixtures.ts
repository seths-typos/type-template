import { resolveConfig } from '../config/index.js';
import type { SheetConfig } from '../config/types.js';

/**
 * The defaults, resolved through config so the tests exercise the real
 * thing rather than a parallel copy. Returns a fresh object each call —
 * tests mutate it freely.
 */
export function baseConfig(): SheetConfig {
  return resolveConfig();
}

/**
 * The defaults with the metrics pinned to fixed, round values: 70% x-height,
 * 105% ascender, -35% descender. Geometry tests hand-check positions against
 * these, so they must not move when the default metrics do.
 */
export function fixedMetricsConfig(): SheetConfig {
  return resolveConfig({ metrics: { xHeight: 70, ascender: 105, descender: -35 } });
}
