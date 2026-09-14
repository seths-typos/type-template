import type { LineStyle, MetricsMode, VerticalAlign } from './types.js';
import type { Orientation, PagePreset } from './presets.js';

const guide = (color: string, dash: number[] | null = null): LineStyle => ({
  visible: true,
  weight: 0.5,
  color,
  dash,
});

/**
 * Every default in one place, in raw input terms.
 *
 * Placeholders — refine after printed proofs. `slant.angle` is deliberately
 * absent: it has no sensible default and is required when slant is enabled.
 */
export const DEFAULTS = {
  page: {
    size: 'letter' as PagePreset,
    orientation: 'landscape' as Orientation,
    margins: { top: 36, right: 36, bottom: 36, left: 36 },
  },
  header: {
    enabled: false,
    height: 54,
    text: '',
  },
  metrics: {
    mode: 'capHeight' as MetricsMode,
    capHeight: 72,
    rowCount: 5,
    xHeight: 70,
    ascender: 105,
    descender: -35,
    rowGap: 36,
    verticalAlign: 'top' as VerticalAlign,
  },
  lines: {
    baseline: guide('#000000'),
    capHeight: guide('#888888'),
    xHeight: guide('#888888', [3, 3]),
    ascender: guide('#888888'),
    descender: guide('#888888'),
  },
  labels: {
    enabled: true,
    size: 6,
    color: '#888888',
    gap: 6,
  },
  slant: {
    enabled: false,
    spacing: 36,
    inset: 72,
    style: guide('#888888'),
  },
} as const satisfies Record<string, unknown>;
