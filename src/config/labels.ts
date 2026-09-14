import type { LinesConfig } from './types.js';

/**
 * The letter set against each metric line. Fixed for type work — a sheet
 * always names the baseline, cap height and x-height, and nothing else.
 *
 * Calligraphy mode will want its own set when it arrives, chosen by mode
 * rather than typed in by the user.
 */
export const METRIC_LABELS: Partial<Record<keyof LinesConfig, string>> = {
  baseline: 'B',
  capHeight: 'C',
  xHeight: 'X',
};
