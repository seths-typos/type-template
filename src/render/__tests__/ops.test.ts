import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../geometry/index.js';
import { fixedMetricsConfig } from '../../testing/fixtures.js';
import { drawOps, type DrawLine, type DrawText } from '../ops.js';
import type { SheetConfig } from '../../config/types.js';
import { METRIC_LABELS } from '../../config/labels.js';

// Defaults are letter / landscape: a 792 x 612 pt page. Ops stay in geometry
// space — top-left origin, y running down — and each renderer transforms from
// there. The PDF renderer's flip is tested against real output in pdf.test.ts.

function ops(config: SheetConfig, options = {}) {
  return drawOps(buildSheet(config), config, options);
}

const lines = (config: SheetConfig) => ops(config).filter((op): op is DrawLine => op.kind === 'line');
const texts = (config: SheetConfig, options = {}) =>
  ops(config, options).filter((op): op is DrawText => op.kind === 'text');
const bySource = (config: SheetConfig, source: string) =>
  lines(config).filter((op) => op.source === source);

describe('drawOps — geometry space', () => {
  it('keeps geometry\u2019s y, unflipped', () => {
    const [ascender] = bySource(fixedMetricsConfig(), 'ascender');

    // Row 0's ascender line is 36 pt from the top of the page, and stays there.
    expect(ascender!.start.y).toBeCloseTo(36, 10);
  });

  it('leaves x untouched', () => {
    const [ascender] = bySource(fixedMetricsConfig(), 'ascender');

    expect(ascender!.start.x).toBe(36);
    expect(ascender!.end.x).toBe(756);
  });

  it('keeps horizontal lines horizontal', () => {
    for (const op of lines(fixedMetricsConfig())) {
      expect(op.start.y).toBeCloseTo(op.end.y, 10);
    }
  });

  it('puts the baseline further down the page than the ascender line', () => {
    const config = fixedMetricsConfig();
    const [ascender] = bySource(config, 'ascender');
    const [baseline] = bySource(config, 'baseline');

    expect(baseline!.start.y).toBeGreaterThan(ascender!.start.y);
    expect(baseline!.start.y).toBeCloseTo(111.6, 10);
  });
});

describe('drawOps — styles', () => {
  it('resolves each line type to its config style', () => {
    const config = fixedMetricsConfig();
    const [baseline] = bySource(config, 'baseline');
    const [xHeight] = bySource(config, 'xHeight');

    // Every metric line is 0.5 pt — only colour separates the x-height.
    expect(baseline!.thickness).toBe(0.5);
    expect(baseline!.color).toEqual({ r: 0x47 / 255, g: 0x48 / 255, b: 0x48 / 255 });

    expect(xHeight!.thickness).toBe(0.5);
    expect(xHeight!.color).toEqual({ r: 0xcb / 255, g: 0x01 / 255, b: 0x06 / 255 });
  });

  it('resolves slant lines to the slant style, not the metric styles', () => {
    const config = fixedMetricsConfig();
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
    const config = fixedMetricsConfig();
    config.lines.xHeight.dash = [3, 2];

    expect(bySource(config, 'xHeight')[0]!.dash).toEqual([3, 2]);
    expect(bySource(config, 'baseline')[0]!.dash).toBeNull();
  });
});

describe('drawOps — visibility', () => {
  it('draws five lines per row when everything is visible', () => {
    const sheet = buildSheet(fixedMetricsConfig());
    expect(lines(fixedMetricsConfig())).toHaveLength(sheet.rows.length * 5);
  });

  it('skips a line whose style is invisible', () => {
    const config = fixedMetricsConfig();
    config.lines.xHeight.visible = false;

    expect(bySource(config, 'xHeight')).toHaveLength(0);
    expect(bySource(config, 'baseline').length).toBeGreaterThan(0);
  });

  it('skips slant lines geometry emitted when the slant style is invisible', () => {
    const config = fixedMetricsConfig();
    config.slant.enabled = true;
    config.slant.style.visible = false;

    const sheet = buildSheet(config);
    const emitted = sheet.rows[0]!.lines.filter((line) => line.type === 'slant');

    expect(emitted.length).toBeGreaterThan(0);
    expect(bySource(config, 'slant')).toHaveLength(0);
  });
});

describe('drawOps — header', () => {
  // Labels are text ops too, so switch them off to isolate the header.
  function withHeader(left: string, center = '', right = ''): SheetConfig {
    const config = fixedMetricsConfig();
    config.labels.enabled = false;
    config.header.enabled = true;
    Object.assign(config.header, { left, center, right });
    return config;
  }

  it('draws nothing when the header is disabled', () => {
    const config = fixedMetricsConfig();
    config.labels.enabled = false;

    expect(texts(config)).toHaveLength(0);
  });

  it('draws nothing when the header is enabled but empty', () => {
    expect(texts(withHeader(''))).toHaveLength(0);
  });

  it('top-aligns the first baseline inside the reserved block', () => {
    const [line] = texts(withHeader('Type Cooker brief'));

    expect(line!.text).toBe('Type Cooker brief');
    expect(line!.x).toBe(36);
    // Block top is at y 36, first baseline one font size below it.
    expect(line!.y).toBeCloseTo(48, 10);
    expect(line!.size).toBe(12);
  });

  it('sets the centre text on the block centre and the right at its right edge', () => {
    const drawn = texts(withHeader('', 'centre', 'right'));

    // The block runs from x 36, 720 pt wide.
    expect(drawn.map(({ text, x, align }) => ({ text, x, align }))).toEqual([
      { text: 'centre', x: 396, align: 'center' },
      { text: 'right', x: 756, align: 'right' },
    ]);
  });

  it('puts all three on the same baseline', () => {
    const drawn = texts(withHeader('left', 'centre', 'right'));

    expect(new Set(drawn.map((op) => op.y)).size).toBe(1);
  });

  it('advances by the line height for each further line', () => {
    const drawn = texts(withHeader('brief\ndate'));

    expect(drawn.map((op) => op.text)).toEqual(['brief', 'date']);
    expect(drawn[1]!.y - drawn[0]!.y).toBeCloseTo(14.4, 10);
  });

  it('takes a style override', () => {
    const [line] = texts(withHeader('brief'), { header: { size: 24, color: '#ff0000' } });

    expect(line!.size).toBe(24);
    expect(line!.color).toEqual({ r: 1, g: 0, b: 0 });
    expect(line!.y).toBeCloseTo(60, 10);
  });

  it('keeps the header clear of the first row', () => {
    const config = withHeader('brief');
    const sheet = buildSheet(config);
    const [line] = texts(config);

    expect(line!.y).toBeLessThan(sheet.rows[0]!.top);
  });
});

describe('drawOps — metric line labels', () => {
  const labels = (config: SheetConfig) =>
    ops(config).filter((op): op is DrawText => op.kind === 'text');

  it('labels the baseline, cap height and x-height of every row', () => {
    const config = fixedMetricsConfig();
    const sheet = buildSheet(config);
    const drawn = labels(config);

    expect(drawn).toHaveLength(sheet.rows.length * 3);
    expect(new Set(drawn.map((op) => op.text))).toEqual(new Set(['B', 'C', 'X']));
  });

  it('leaves the ascender and descender unlabelled by default', () => {
    expect(labels(fixedMetricsConfig()).map((op) => op.text)).not.toContain('A');
  });

  it('sets them in the left margin, clear of the writing area', () => {
    const config = fixedMetricsConfig();
    const [label] = labels(config);

    // Right edge sits the configured gap before the line's left end.
    expect(label!.x).toBe(36 - 6);
    expect(label!.align).toBe('right');
    expect(label!.size).toBe(6);
  });

  it('centres each label on its own line', () => {
    const config = fixedMetricsConfig();
    const drawn = labels(config);
    const baseline = drawn.find((op) => op.text === 'B');
    const capHeight = drawn.find((op) => op.text === 'C');

    expect(baseline!.anchor).toBe('center');
    // Row 0's baseline is 111.6 from the top, its cap height line 39.6.
    expect(baseline!.y).toBeCloseTo(111.6, 10);
    expect(capHeight!.y).toBeCloseTo(39.6, 10);
  });

  it('drops the label when its line is switched off', () => {
    const config = fixedMetricsConfig();
    config.lines.xHeight.visible = false;

    expect(labels(config).map((op) => op.text)).not.toContain('X');
    expect(labels(config).map((op) => op.text)).toContain('B');
  });

  it('draws none when labels are disabled', () => {
    const config = fixedMetricsConfig();
    config.labels.enabled = false;

    expect(labels(config)).toHaveLength(0);
  });

  it('uses the fixed type-design set, not something configurable', () => {
    expect(new Set(labels(fixedMetricsConfig()).map((op) => op.text))).toEqual(
      new Set(Object.values(METRIC_LABELS)),
    );
  });
});
