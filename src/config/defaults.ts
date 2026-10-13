import type { LineStyle, MetricsMode, VerticalAlign } from './types.js';
import type { Orientation, PagePreset } from './presets.js';
import { DEFAULT_FONT_UNITS, fontUnitsToPercent } from './font-units.js';

/** The default metrics, entered in font units the way a font editor takes them. */
const fontMetrics = fontUnitsToPercent(DEFAULT_FONT_UNITS);

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
    left: '',
    center: '',
    right: '',
  },
  metrics: {
    mode: 'capHeight' as MetricsMode,
    capHeight: 72,
    rowCount: 5,
    xHeight: fontMetrics.xHeight,
    ascender: fontMetrics.ascender,
    descender: fontMetrics.descender,
    rowGap: 36,
    verticalAlign: 'top' as VerticalAlign,
  },
  lines: {
    baseline: guide('#474848'),
    capHeight: guide('#474848'),
    xHeight: guide('#cb0106', [3, 3]),
    ascender: guide('#474848'),
    descender: guide('#474848'),
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
    style: guide('#999999'),
  },
} as const satisfies Record<string, unknown>;
