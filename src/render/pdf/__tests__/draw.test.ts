import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../../geometry/index.js';
import { baseConfig } from '../../../testing/fixtures.js';
import { drawOps, type DrawLine, type DrawText } from '../draw.js';
import type { SheetConfig } from '../../../config/types.js';

// Defaults are letter / landscape: a 792 x 612 pt page. Geometry's y runs down
// from the top, PDF's runs up from the bottom, so pdfY = 612 - y.

function ops(config: SheetConfig, options = {}) {
  return drawOps(buildSheet(config), config, options);
}

const lines = (config: SheetConfig) => ops(config).filter((op): op is DrawLine => op.kind === 'line');
const texts = (config: SheetConfig, options = {}) =>
  ops(config, options).filter((op): op is DrawText => op.kind === 'text');
const bySource = (config: SheetConfig, source: string) =>
  lines(config).filter((op) => op.source === source);

describe('drawOps — the y-axis flip', () => {
  it('flips geometry y into PDF y', () => {
    const [ascender] = bySource(baseConfig(), 'ascender');

    // Row 0's ascender line is 36 pt from the top of the page.
    expect(ascender!.start.y).toBeCloseTo(576, 10);
  });

  it('leaves x untouched', () => {
    const [ascender] = bySource(baseConfig(), 'ascender');

    expect(ascender!.start.x).toBe(36);
    expect(ascender!.end.x).toBe(756);
  });

  it('keeps horizontal lines horizontal', () => {
    for (const op of lines(baseConfig())) {
      expect(op.start.y).toBeCloseTo(op.end.y, 10);
    }
  });

  it('puts the baseline below the ascender line in PDF space', () => {
    const config = baseConfig();
    const [ascender] = bySource(config, 'ascender');
    const [baseline] = bySource(config, 'baseline');

    expect(baseline!.start.y).toBeLessThan(ascender!.start.y);
    expect(baseline!.start.y).toBeCloseTo(500.4, 10);
  });
});

describe('drawOps — styles', () => {
  it('resolves each line type to its config style', () => {
    const config = baseConfig();
    const [baseline] = bySource(config, 'baseline');
    const [xHeight] = bySource(config, 'xHeight');

    expect(baseline!.thickness).toBe(1);
    expect(baseline!.color).toEqual({ r: 0, g: 0, b: 0 });

    expect(xHeight!.thickness).toBe(0.5);
    expect(xHeight!.color.r).toBeCloseTo(0x88 / 255, 10);
  });

  it('resolves slant lines to the slant style, not the metric styles', () => {
    const config = baseConfig();
    config.slant.enabled = true;
    config.slant.style.weight = 0.25;
    config.slant.style.color = '#ff0000';

    const slants = bySource(config, 'slant');

    expect(slants.length).toBeGreaterThan(0);
    for (const op of slants) {
      expect(op.thickness).toBe(0.25);
      expect(op.color).toEqual({ r: 1, g: 0, b: 0 });
    }
  });

  it('passes a dash array through, and null for solid', () => {
    const config = baseConfig();
    config.lines.xHeight.dash = [3, 2];

    expect(bySource(config, 'xHeight')[0]!.dash).toEqual([3, 2]);
    expect(bySource(config, 'baseline')[0]!.dash).toBeNull();
  });
});

describe('drawOps — visibility', () => {
  it('draws five lines per row when everything is visible', () => {
    const sheet = buildSheet(baseConfig());
    expect(lines(baseConfig())).toHaveLength(sheet.rows.length * 5);
  });

  it('skips a line whose style is invisible', () => {
    const config = baseConfig();
    config.lines.xHeight.visible = false;

    expect(bySource(config, 'xHeight')).toHaveLength(0);
    expect(bySource(config, 'baseline').length).toBeGreaterThan(0);
  });

  it('skips slant lines geometry emitted when the slant style is invisible', () => {
    const config = baseConfig();
    config.slant.enabled = true;
    config.slant.style.visible = false;

    const sheet = buildSheet(config);
    const emitted = sheet.rows[0]!.lines.filter((line) => line.type === 'slant');

    expect(emitted.length).toBeGreaterThan(0);
    expect(bySource(config, 'slant')).toHaveLength(0);
  });
});

describe('drawOps — header', () => {
  function withHeader(text: string): SheetConfig {
    const config = baseConfig();
    config.header.enabled = true;
    config.header.text = text;
    return config;
  }

  it('draws nothing when the header is disabled', () => {
    expect(texts(baseConfig())).toHaveLength(0);
  });

  it('draws nothing when the header is enabled but empty', () => {
    expect(texts(withHeader(''))).toHaveLength(0);
  });

  it('top-aligns the first baseline inside the reserved block', () => {
    const [line] = texts(withHeader('Type Cooker brief'));

    expect(line!.text).toBe('Type Cooker brief');
    expect(line!.x).toBe(36);
    // Block top is at y 36, first baseline one font size below: 612 - 48.
    expect(line!.y).toBeCloseTo(564, 10);
    expect(line!.size).toBe(12);
  });

  it('advances by the line height for each further line', () => {
    const drawn = texts(withHeader('brief\ndate'));

    expect(drawn.map((op) => op.text)).toEqual(['brief', 'date']);
    expect(drawn[0]!.y - drawn[1]!.y).toBeCloseTo(14.4, 10);
  });

  it('takes a style override', () => {
    const [line] = texts(withHeader('brief'), { header: { size: 24, color: '#ff0000' } });

    expect(line!.size).toBe(24);
    expect(line!.color).toEqual({ r: 1, g: 0, b: 0 });
    expect(line!.y).toBeCloseTo(612 - 60, 10);
  });

  it('keeps the header clear of the first row', () => {
    const config = withHeader('brief');
    const sheet = buildSheet(config);
    const [line] = texts(config);
    const firstRowTop = 612 - sheet.rows[0]!.top;

    expect(line!.y).toBeGreaterThan(firstRowTop);
  });
});
