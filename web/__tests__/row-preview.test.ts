import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/index.js';
import { rowPreviewLayout } from '../row-preview.js';

const yOf = (layout: ReturnType<typeof rowPreviewLayout>, type: string) =>
  layout.lines.find((line) => line.type === type)?.y;

describe('rowPreviewLayout', () => {
  it('stacks the lines top to bottom, ascender to descender', () => {
    const layout = rowPreviewLayout(resolveConfig({}));

    expect(layout.lines.map((line) => line.type)).toEqual([
      'ascender',
      'capHeight',
      'xHeight',
      'baseline',
      'descender',
    ]);
    const ys = layout.lines.map((line) => line.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('fills the same band whatever the metrics', () => {
    for (const metrics of [{}, { ascender: 140, descender: -10 }, { ascender: 0, descender: 0 }]) {
      const layout = rowPreviewLayout(resolveConfig({ metrics }));
      const ys = layout.lines.map((line) => line.y);

      expect(Math.min(...ys)).toBeCloseTo(29.5, 10);
      expect(Math.max(...ys)).toBeCloseTo(199.5, 10);
    }
  });

  it('places the x-height as a share of cap height above the baseline', () => {
    const layout = rowPreviewLayout(resolveConfig({ metrics: { xHeight: 50 } }));
    const baseline = yOf(layout, 'baseline')!;
    const cap = yOf(layout, 'capHeight')!;

    expect(yOf(layout, 'xHeight')).toBeCloseTo(baseline - (baseline - cap) / 2, 10);
  });

  it('drops a line when it is not visible', () => {
    const layout = rowPreviewLayout(resolveConfig({ lines: { xHeight: { visible: false } } }));

    expect(layout.lines.map((line) => line.type)).toEqual([
      'ascender',
      'capHeight',
      'baseline',
      'descender',
    ]);
  });

  it('draws slant lines only when slant is enabled', () => {
    expect(rowPreviewLayout(resolveConfig({})).slants).toEqual([]);

    const on = rowPreviewLayout(resolveConfig({ slant: { enabled: true, angle: 30 } }));
    expect(on.slants.length).toBeGreaterThan(0);
    for (const { start, end } of on.slants) {
      expect(Math.min(start.y, end.y)).toBeGreaterThanOrEqual(29.5 - 1e-9);
      expect(Math.max(start.x, end.x)).toBeLessThanOrEqual(90 + 1e-9);
    }
  });

  it('shows a slant line entering from the left edge, above the corner one', () => {
    const layout = rowPreviewLayout(resolveConfig({ slant: { enabled: true, angle: 30 } }));
    const [first] = layout.slants;
    const bottom = first!.start.y > first!.end.y ? first!.start : first!.end;

    expect(bottom.x).toBeCloseTo(0, 10);
    expect(bottom.y).toBeLessThan(layout.lines.at(-1)!.y);
  });

  it('starts a slant line at the left end of the lowest metric line', () => {
    for (const metrics of [{}, { descender: 0 }]) {
      const layout = rowPreviewLayout(
        resolveConfig({ metrics, slant: { enabled: true, angle: 30 } }),
      );
      const lowest = layout.lines.at(-1)!;
      const bottoms = layout.slants.map(({ start, end }) => (start.y > end.y ? start : end));

      expect(
        bottoms.some((p) => Math.abs(p.x) < 1e-9 && Math.abs(p.y - lowest.y) < 1e-9),
      ).toBe(true);
    }
  });
});
