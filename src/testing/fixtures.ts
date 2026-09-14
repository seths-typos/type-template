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
