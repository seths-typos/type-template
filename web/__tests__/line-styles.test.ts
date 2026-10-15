import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/index.js';
import { LINE_COLORS, STYLED_LINES, defaultLineStyles, toLineStyle } from '../line-styles.js';

describe('line styles', () => {
  it('offers all six lines', () => {
    expect(STYLED_LINES.map((line) => line.type)).toEqual([
      'ascender',
      'capHeight',
      'xHeight',
      'baseline',
      'descender',
      'slant',
    ]);
  });

  it('maps thin, medium and thick to 0.5, 1 and 1.5 pt', () => {
    const at = (weight: 1 | 2 | 3) => toLineStyle({ weight, dashed: false, color: '#132322' }).weight;
    expect([at(1), at(2), at(3)]).toEqual([0.5, 1, 1.5]);
  });

  it("dashes with the engine's x-height dash, or not at all", () => {
    const dashed = toLineStyle({ weight: 1, dashed: true, color: '#132322' });
    const solid = toLineStyle({ weight: 1, dashed: false, color: '#132322' });
    expect(dashed.dash).toEqual(resolveConfig({}).lines.xHeight.dash);
    expect(solid.dash).toBeNull();
  });

  it("starts the metric lines but the baseline at the engine's defaults", () => {
    const engine = resolveConfig({}).lines;
    const styles = defaultLineStyles();
    for (const type of ['ascender', 'capHeight', 'xHeight', 'descender'] as const) {
      const { visible: _visible, ...style } = engine[type];
      expect(toLineStyle(styles[type])).toEqual(style);
    }
  });

  it('starts the baseline black, medium and solid', () => {
    expect(defaultLineStyles().baseline).toEqual({ weight: 2, dashed: false, color: '#132322' });
  });

  it('starts every line on a colour the panel offers', () => {
    const offered = LINE_COLORS.map((color) => color.value);
    for (const choice of Object.values(defaultLineStyles())) {
      expect(offered).toContain(choice.color);
    }
  });

  it('resolves every choice through config', () => {
    for (const color of LINE_COLORS) {
      for (const weight of [1, 2, 3] as const) {
        for (const dashed of [false, true]) {
          const style = toLineStyle({ weight, dashed, color: color.value });
          expect(() =>
            resolveConfig({
              lines: { baseline: style },
              slant: { enabled: true, angle: 10, style },
            }),
          ).not.toThrow();
        }
      }
    }
  });
});
