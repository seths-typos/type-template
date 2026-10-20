import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_UNITS, DEFAULTS } from '../../src/index.js';
import { defaultLineStyles } from '../line-styles.js';
import { rowInput, slantSpacing, type RowState } from '../row-input.js';

const row = (angle: number): RowState => ({
  units: { ...DEFAULT_FONT_UNITS },
  visible: { ascender: true, capHeight: true, xHeight: true, baseline: true, descender: true },
  slant: { enabled: true, angle },
});

describe('slantSpacing', () => {
  it('is the default spacing upright', () => {
    expect(slantSpacing(0)).toBe(DEFAULTS.slant.spacing);
  });

  it('holds the gap square to the lines at the default, at any angle', () => {
    for (const angle of [-75, -30, 8, 15, 30, 60, 75, 85]) {
      const square = slantSpacing(angle) * Math.cos((angle * Math.PI) / 180);
      expect(square).toBeCloseTo(DEFAULTS.slant.spacing, 9);
    }
  });

  it('spreads further the more the lines lean, either way', () => {
    expect(slantSpacing(75)).toBeGreaterThan(slantSpacing(30));
    expect(slantSpacing(30)).toBeGreaterThan(slantSpacing(0));
    expect(slantSpacing(-30)).toBeCloseTo(slantSpacing(30), 9);
    expect(slantSpacing(75)).toBeCloseTo(139.1, 1);
  });

  it('goes into a row\'s input with its angle', () => {
    const input = rowInput(row(75), defaultLineStyles())!;
    expect(input.slant).toMatchObject({ angle: 75, spacing: slantSpacing(75) });
  });
});
