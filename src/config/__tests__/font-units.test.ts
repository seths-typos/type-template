import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_UNITS, fontUnitsToPercent } from '../font-units.js';

describe('fontUnitsToPercent', () => {
  it('measures each metric as a share of the cap height', () => {
    expect(
      fontUnitsToPercent({ ascender: 750, capHeight: 500, xHeight: 250, descender: -250 }),
    ).toEqual({ ascender: 150, xHeight: 50, descender: -50 });
  });

  it('depends only on ratios, not on the size of the em', () => {
    const at1000 = fontUnitsToPercent(DEFAULT_FONT_UNITS);
    const at2048 = fontUnitsToPercent({
      ascender: 1600,
      capHeight: 1400,
      xHeight: 1000,
      descender: -400,
    });

    expect(at2048.ascender).toBeCloseTo(at1000.ascender, 10);
    expect(at2048.xHeight).toBeCloseTo(at1000.xHeight, 10);
    expect(at2048.descender).toBeCloseTo(at1000.descender, 10);
  });

  it('rejects a cap height of zero, which nothing can be measured against', () => {
    expect(() =>
      fontUnitsToPercent({ ascender: 800, capHeight: 0, xHeight: 500, descender: -200 }),
    ).toThrow(/cap height/i);
  });
});
