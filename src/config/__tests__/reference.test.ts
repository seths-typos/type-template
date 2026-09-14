import { describe, expect, it } from 'vitest';
import { toCapHeightReference } from '../reference.js';

const METRICS = { capHeight: 72, xHeight: 70, ascender: 105, descender: -35 };

describe('toCapHeightReference', () => {
  // The isolation rule: this is the only place that knows cap height is the
  // reference. Switching the reference means changing this and nothing else.
  it('expresses every metric against cap height', () => {
    expect(toCapHeightReference(METRICS)).toEqual({
      capHeight: 72,
      xHeight: 70,
      ascender: 105,
      descender: -35,
    });
  });

  it('gives back cap height in points and the rest as percentages', () => {
    const referenced = toCapHeightReference({ ...METRICS, capHeight: 144 });

    expect(referenced.capHeight).toBe(144);
    expect(referenced.xHeight).toBe(70);
  });
});
