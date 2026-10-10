import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_UNITS } from '../../src/index.js';
import { metricOrderErrors } from '../metric-order.js';

const ALL_ON = { ascender: true, capHeight: true, xHeight: true, baseline: true, descender: true };

const check = (units: Partial<typeof DEFAULT_FONT_UNITS>, visible = ALL_ON) =>
  metricOrderErrors({ ...DEFAULT_FONT_UNITS, ...units }, visible);

describe('metricOrderErrors', () => {
  it('passes the defaults', () => {
    expect(check({}).size).toBe(0);
  });

  it('wants the ascender above the cap height, not on it', () => {
    expect(check({ ascender: 700 }).get('metrics.ascender')).toMatch(/above the cap height/);
    expect(check({ ascender: 650 }).has('metrics.ascender')).toBe(true);
    expect(check({ ascender: 701 }).has('metrics.ascender')).toBe(false);
  });

  it('wants the x-height strictly between the baseline and the cap height', () => {
    for (const xHeight of [0, -10, 700, 750]) {
      expect(check({ xHeight }).get('metrics.xHeight')).toMatch(/between 0 and the cap height/);
    }
    expect(check({ xHeight: 1 }).has('metrics.xHeight')).toBe(false);
    expect(check({ xHeight: 699 }).has('metrics.xHeight')).toBe(false);
  });

  it('wants the descender below the baseline', () => {
    expect(check({ descender: 0 }).get('metrics.descender')).toMatch(/below 0/);
    expect(check({ descender: 50 }).has('metrics.descender')).toBe(true);
    expect(check({ descender: -1 }).has('metrics.descender')).toBe(false);
  });

  it('measures against the cap height as typed', () => {
    // A taller cap height moves the bounds with it.
    const errors = check({ capHeight: 900 });
    expect([...errors.keys()].sort()).toEqual(['metrics.ascender']);
  });

  it('skips a metric that is switched off', () => {
    const off = { ...ALL_ON, ascender: false, xHeight: false, descender: false };
    expect(check({ ascender: 0, xHeight: 900, descender: 10 }, off).size).toBe(0);
  });
});
