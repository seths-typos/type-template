import { describe, expect, it } from 'vitest';
import { buildSheet } from '../sheet.js';
import type { LineType } from '../types.js';
import { baseConfig } from '../../testing/fixtures.js';

// Defaults are letter / landscape: a 792 x 612 pt page, 36 pt margins,
// leaving a 720 x 540 pt area.

describe('buildSheet — available area', () => {
  it('sits inside the margins', () => {
    const { area } = buildSheet(baseConfig());

    expect(area).toEqual({
      top: 36,
      right: 756,
      bottom: 576,
      left: 36,
      width: 720,
      height: 540,
    });
  });

  it('reserves the header below the top margin', () => {
    const config = baseConfig();
    config.header.enabled = true;
    config.header.text = 'Type Cooker brief';

    const sheet = buildSheet(config);

    expect(sheet.area.top).toBe(90);
    expect(sheet.area.height).toBe(486);
    expect(sheet.header).toEqual({
      x: 36,
      y: 36,
      width: 720,
      height: 54,
      text: 'Type Cooker brief',
    });
  });

  it('omits the header block when disabled', () => {
    expect(buildSheet(baseConfig()).header).toBeNull();
  });

  it('rejects margins that leave no room', () => {
    const config = baseConfig();
    config.page.margins = { top: 400, right: 36, bottom: 400, left: 36 };

    expect(() => buildSheet(config)).toThrow(/no room/);
  });

  it('rejects a page with no dimensions', () => {
    const config = baseConfig();
    config.page.width = 0;

    expect(() => buildSheet(config)).toThrow(/positive dimensions/);
  });
});

describe('buildSheet — capHeight mode', () => {
  it('fills the available height with whole rows at the given pitch', () => {
    const sheet = buildSheet(baseConfig());

    expect(sheet.capHeight).toBe(72);
    expect(sheet.totalMetricHeight).toBeCloseTo(100.8, 10);
    expect(sheet.rowPitch).toBeCloseTo(136.8, 10);
    expect(sheet.rows).toHaveLength(4);
  });

  it('positions the first row band against the top of the area', () => {
    const [row] = buildSheet(baseConfig()).rows;

    expect(row!.top).toBe(36);
    expect(row!.baseline).toBeCloseTo(111.6, 10);
    expect(row!.bottom).toBeCloseTo(136.8, 10);
  });

  it('spaces rows one band bottom to the next band top apart', () => {
    const rows = buildSheet(baseConfig()).rows;

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.top - rows[i - 1]!.bottom).toBeCloseTo(36, 10);
    }
  });

  it('throws when not even one row fits', () => {
    const config = baseConfig();
    config.metrics.capHeight = 600;

    expect(() => buildSheet(config)).toThrow(/No rows fit/);
  });
});

describe('buildSheet — rowCount mode', () => {
  it('solves a cap height that makes the rows exactly fill the area', () => {
    const config = baseConfig();
    config.metrics.mode = 'rowCount';
    config.metrics.rowCount = 6;

    const sheet = buildSheet(config);

    expect(sheet.rows).toHaveLength(6);
    expect(sheet.rows[0]!.top).toBe(36);
    expect(sheet.rows.at(-1)!.bottom).toBeCloseTo(576, 10);
  });

  it('holds the row gap fixed and ignores the input cap height', () => {
    const config = baseConfig();
    config.metrics.mode = 'rowCount';
    config.metrics.rowCount = 5;
    config.metrics.capHeight = 999;

    const sheet = buildSheet(config);

    expect(sheet.capHeight).toBeCloseTo(396 / 7, 10);
    expect(sheet.rows[1]!.top - sheet.rows[0]!.bottom).toBeCloseTo(36, 10);
  });
});

describe('buildSheet — verticalAlign', () => {
  it('top leaves the slack at the bottom', () => {
    const sheet = buildSheet(baseConfig());

    expect(sheet.rows[0]!.top).toBe(36);
    expect(sheet.rows.at(-1)!.bottom).toBeCloseTo(547.2, 10);
  });

  it('center splits the slack evenly above and below', () => {
    const config = baseConfig();
    config.metrics.verticalAlign = 'center';

    const sheet = buildSheet(config);
    const above = sheet.rows[0]!.top - sheet.area.top;
    const below = sheet.area.bottom - sheet.rows.at(-1)!.bottom;

    expect(above).toBeCloseTo(below, 10);
    expect(above).toBeCloseTo(14.4, 10);
  });

  it('justify distributes the slack into the gaps', () => {
    const config = baseConfig();
    config.metrics.verticalAlign = 'justify';

    const rows = buildSheet(config).rows;

    expect(rows[0]!.top).toBe(36);
    expect(rows.at(-1)!.bottom).toBeCloseTo(576, 10);

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.top - rows[i - 1]!.bottom).toBeCloseTo(45.6, 10);
    }
  });

  it('justify falls back to top with a single row', () => {
    const config = baseConfig();
    config.metrics.verticalAlign = 'justify';
    config.metrics.capHeight = 300;

    const sheet = buildSheet(config);

    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0]!.top).toBe(36);
    expect(sheet.rows[0]!.bottom).toBeCloseTo(456, 10);
  });

  it('leaves rowCount mode untouched — there is no slack to distribute', () => {
    const config = baseConfig();
    config.metrics.mode = 'rowCount';
    config.metrics.verticalAlign = 'justify';

    const justified = buildSheet(config);
    config.metrics.verticalAlign = 'top';
    const topped = buildSheet(config);

    expect(justified.rows.map((r) => r.top)).toEqual(topped.rows.map((r) => r.top));
  });
});

describe('buildSheet — metric lines', () => {
  it('emits all five metric lines per row, top to bottom', () => {
    const [row] = buildSheet(baseConfig()).rows;
    const types = row!.lines.map((line) => line.type);

    expect(types).toEqual<LineType[]>([
      'ascender',
      'capHeight',
      'xHeight',
      'baseline',
      'descender',
    ]);
  });

  it('emits metric lines regardless of visibility — that is the renderer’s call', () => {
    const config = baseConfig();
    config.lines.xHeight.visible = false;

    const [row] = buildSheet(config).rows;

    expect(row!.lines.some((line) => line.type === 'xHeight')).toBe(true);
  });

  it('spans the full available width horizontally', () => {
    const [row] = buildSheet(baseConfig()).rows;

    for (const line of row!.lines) {
      expect(line.start.x).toBe(36);
      expect(line.end.x).toBe(756);
      expect(line.start.y).toBe(line.end.y);
    }
  });

  it('orders the metric lines down the page', () => {
    const [row] = buildSheet(baseConfig()).rows;
    const ys = row!.lines.map((line) => line.start.y);

    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[0]).toBeCloseTo(row!.top, 10);
    expect(ys.at(-1)).toBeCloseTo(row!.bottom, 10);
  });
});

describe('buildSheet — the row band follows the metrics present', () => {
  it('closes down to the cap height line when there is no ascender', () => {
    const config = baseConfig();
    config.metrics.ascender = 100;

    const sheet = buildSheet(config);
    const [row] = sheet.rows;

    expect(sheet.totalMetricHeight).toBeCloseTo(97.2, 10);
    // The band top is now the cap height line, 72 pt above the baseline.
    expect(row!.baseline - row!.top).toBeCloseTo(72, 10);

    const capLine = row!.lines.find((line) => line.type === 'capHeight');
    expect(capLine!.start.y).toBeCloseTo(row!.top, 10);
  });

  it('closes up to the baseline when there is no descender', () => {
    const config = baseConfig();
    config.metrics.descender = 0;

    const [row] = buildSheet(config).rows;

    expect(row!.bottom).toBeCloseTo(row!.baseline, 10);
  });

  it('fits more rows once the band closes on both ends', () => {
    const config = baseConfig();
    config.metrics.ascender = 100;
    config.metrics.descender = 0;

    const sheet = buildSheet(config);

    expect(sheet.totalMetricHeight).toBeCloseTo(72, 10);
    expect(sheet.rows).toHaveLength(5);
  });

  it('follows an x-height that reaches above the ascender', () => {
    const config = baseConfig();
    config.metrics.xHeight = 130;

    const [row] = buildSheet(config).rows;
    const xLine = row!.lines.find((line) => line.type === 'xHeight');

    expect(xLine!.start.y).toBeCloseTo(row!.top, 10);
  });
});
