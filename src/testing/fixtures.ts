import { resolvePageSize } from '../config/presets.js';
import type { LineStyle, SheetConfig } from '../config/types.js';

const solid = (weight: number, color: string): LineStyle => ({
  visible: true,
  weight,
  color,
  dash: null,
});

/**
 * The documented defaults, hardcoded here rather than in geometry — geometry
 * owns no defaults. Replace with the real config module once it exists.
 */
export function baseConfig(): SheetConfig {
  return {
    page: {
      // Defaults: letter, landscape -> 792 x 612 pt.
      ...resolvePageSize('letter', 'landscape'),
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    },
    header: { enabled: false, height: 54, text: '' },
    metrics: {
      mode: 'capHeight',
      capHeight: 72,
      rowCount: 5,
      xHeight: 70,
      ascender: 105,
      descender: -35,
      rowGap: 36,
      verticalAlign: 'top',
    },
    lines: {
      baseline: solid(1, '#000000'),
      capHeight: solid(0.5, '#888888'),
      xHeight: solid(0.5, '#888888'),
      ascender: solid(0.5, '#888888'),
      descender: solid(0.5, '#888888'),
    },
    slant: {
      enabled: false,
      angle: 15,
      spacing: 36,
      inset: 72,
      style: solid(0.5, '#888888'),
    },
  };
}
