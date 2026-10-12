import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_UNITS } from '../../src/index.js';
import { defaultLineStyles } from '../line-styles.js';
import { rowInput, type RowState } from '../row-input.js';
import { previewSheet } from '../sheet-preview.js';

const row = (patch: Partial<RowState> = {}): RowState => ({
  units: { ...DEFAULT_FONT_UNITS },
  visible: { ascender: true, capHeight: true, xHeight: true, baseline: true, descender: true },
  slant: { enabled: true, angle: 30 },
  ...patch,
});

const input = (state: RowState) => rowInput(state, defaultLineStyles())!;

describe('previewSheet', () => {
  it('draws one row per input on a landscape page', () => {
    const { sheet } = previewSheet([input(row()), input(row()), input(row())]);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.page.width).toBeGreaterThan(sheet.page.height);
  });

  it('leaves the metric labels off', () => {
    expect(previewSheet([input(row())]).config.labels.enabled).toBe(false);
  });

  it('gives every row the same band, whatever its metrics', () => {
    const tall = row({ units: { ascender: 900, capHeight: 600, xHeight: 300, descender: -300 } });
    const { sheet } = previewSheet([input(row()), input(tall)]);
    const [a, b] = sheet.rows;
    expect(b!.bottom - b!.top).toBeCloseTo(a!.bottom - a!.top, 6);
    expect(b!.top).toBeGreaterThan(a!.bottom);
  });

  it("places each row's metrics by its own input", () => {
    const low = row({ units: { ...DEFAULT_FONT_UNITS, xHeight: 300 } });
    const { sheet } = previewSheet([input(row()), input(low)]);
    const xHeightOffset = (i: number) => {
      const r = sheet.rows[i]!;
      return r.baseline - r.lines.find((line) => line.type === 'xHeight')!.start.y;
    };
    expect(xHeightOffset(1)).toBeLessThan(xHeightOffset(0));
  });

  it("drops a row's hidden lines but keeps them in the others", () => {
    const noX = row({
      visible: { ascender: true, capHeight: true, xHeight: false, baseline: true, descender: true },
    });
    const { sheet, config } = previewSheet([input(row()), input(noX)]);
    const types = (i: number) => new Set(sheet.rows[i]!.lines.map((line) => line.type));
    expect(types(0).has('xHeight')).toBe(true);
    expect(types(1).has('xHeight')).toBe(false);
    expect(config.lines.xHeight.visible).toBe(true);
  });

  it('keeps slant lines only on rows with an italic angle', () => {
    const upright = row({ slant: { enabled: false, angle: null } });
    const { sheet } = previewSheet([input(row()), input(upright)]);
    const slants = (i: number) => sheet.rows[i]!.lines.filter((line) => line.type === 'slant').length;
    expect(slants(0)).toBeGreaterThan(0);
    expect(slants(1)).toBe(0);
  });
});
