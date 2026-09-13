import { describe, expect, it } from 'vitest';
import {
  fitRowCount,
  metricHeightRatio,
  metricOffsets,
  rowPitch,
  solveCapHeight,
  totalMetricHeight,
} from '../metrics.js';

const METRICS = { xHeight: 70, ascender: 105, descender: -35 };

describe('metricOffsets', () => {
  it('measures heights up from the baseline', () => {
    const offsets = metricOffsets(72, METRICS);

    expect(offsets.ascender).toBeCloseTo(75.6, 10);
    expect(offsets.capHeight).toBeCloseTo(72, 10);
    expect(offsets.xHeight).toBeCloseTo(50.4, 10);
    expect(offsets.baseline).toBe(0);
    expect(offsets.descender).toBeCloseTo(-25.2, 10);
  });

  it('puts an x-height percentage that fraction of the cap height up', () => {
    const offsets = metricOffsets(72, { ...METRICS, xHeight: 60 });

    expect(offsets.xHeight).toBeCloseTo(0.6 * 72, 10);
  });

  it('scales every metric off the absolute cap height', () => {
    const offsets = metricOffsets(144, METRICS);

    expect(offsets.capHeight).toBeCloseTo(144, 10);
    expect(offsets.xHeight).toBeCloseTo(100.8, 10);
  });
});

describe('totalMetricHeight', () => {
  it('spans ascender to descender', () => {
    expect(totalMetricHeight(72, METRICS)).toBeCloseTo(100.8, 10);
  });

  it('rejects a descender above the ascender', () => {
    expect(() => metricHeightRatio({ ascender: -10, descender: 10 })).toThrow(/must be above/);
  });

  it('rejects a non-positive cap height', () => {
    expect(() => totalMetricHeight(0, METRICS)).toThrow(/greater than 0/);
  });
});

describe('fitRowCount', () => {
  it('counts gaps between rows only, not after the last one', () => {
    // 5 rows: 5 x 100.8 + 4 x 36 = 648, under 720. A 6th needs 784.8.
    expect(fitRowCount(720, 100.8, 36)).toBe(5);
  });

  it('takes an exact fit without rounding down', () => {
    expect(fitRowCount(648, 100.8, 36)).toBe(5);
  });

  it('returns 0 when not even one row fits', () => {
    expect(fitRowCount(50, 100.8, 36)).toBe(0);
  });
});

describe('solveCapHeight', () => {
  it('solves so the rows exactly fill the height', () => {
    const capHeight = solveCapHeight(720, 5, 36, METRICS);
    const height = totalMetricHeight(capHeight, METRICS);

    expect(5 * height + 4 * 36).toBeCloseTo(720, 10);
    expect(capHeight).toBeCloseTo(576 / 7, 10);
  });

  it('holds the row gap fixed', () => {
    const capHeight = solveCapHeight(720, 3, 60, METRICS);
    expect(3 * totalMetricHeight(capHeight, METRICS) + 2 * 60).toBeCloseTo(720, 10);
  });

  it('rejects a row count that cannot fit', () => {
    expect(() => solveCapHeight(100, 5, 36, METRICS)).toThrow(/do not fit/);
  });

  it('rejects a non-integer or zero row count', () => {
    expect(() => solveCapHeight(720, 0, 36, METRICS)).toThrow(/positive integer/);
    expect(() => solveCapHeight(720, 2.5, 36, METRICS)).toThrow(/positive integer/);
  });
});

describe('rowPitch', () => {
  it('is total metric height plus the gap', () => {
    expect(rowPitch(100.8, 36)).toBeCloseTo(136.8, 10);
  });
});
