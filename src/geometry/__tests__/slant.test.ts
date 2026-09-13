import { describe, expect, it } from 'vitest';
import { buildSheet } from '../sheet.js';
import type { LineSegment, Row } from '../types.js';
import { baseConfig } from '../../testing/fixtures.js';

/** x where a segment's line crosses the row's baseline. */
function baselineAnchor(row: Row, line: LineSegment): number {
  const t = (row.baseline - line.start.y) / (line.end.y - line.start.y);
  return line.start.x + t * (line.end.x - line.start.x);
}

function slantOnly(row: Row): LineSegment[] {
  return row.lines.filter((line) => line.type === 'slant');
}

function slantConfig() {
  const config = baseConfig();
  config.slant.enabled = true;
  return config;
}

describe('slant lines', () => {
  it('emits none when disabled', () => {
    const [row] = buildSheet(baseConfig()).rows;
    expect(slantOnly(row!)).toHaveLength(0);
  });

  it('anchors the first line at the inset from the row’s left edge', () => {
    const [row] = buildSheet(slantConfig()).rows;
    const [first] = slantOnly(row!);

    expect(baselineAnchor(row!, first!)).toBeCloseTo(row!.left + 72, 10);
  });

  it('spaces anchors along the baseline', () => {
    const [row] = buildSheet(slantConfig()).rows;
    const anchors = slantOnly(row!).map((line) => baselineAnchor(row!, line));

    for (let i = 1; i < anchors.length; i++) {
      expect(anchors[i]! - anchors[i - 1]!).toBeCloseTo(36, 8);
    }
  });

  it('generates lines until they leave the right edge', () => {
    const [row] = buildSheet(slantConfig()).rows;
    const lines = slantOnly(row!);
    const anchors = lines.map((line) => baselineAnchor(row!, line));

    expect(lines).toHaveLength(19);
    expect(anchors.at(-1)!).toBeCloseTo(756, 8);
  });

  it('leans right for a positive angle, measured from vertical', () => {
    const [row] = buildSheet(slantConfig()).rows;
    const [first] = slantOnly(row!);

    // 15 degrees from vertical over the 75.6 pt from baseline to ascender.
    expect(first!.start.y).toBeCloseTo(row!.top, 10);
    expect(first!.start.x).toBeCloseTo(108 + 75.6 * Math.tan(Math.PI / 12), 10);
    expect(first!.end.y).toBeCloseTo(row!.bottom, 10);
    expect(first!.end.x).toBeCloseTo(108 - 25.2 * Math.tan(Math.PI / 12), 10);
  });

  it('leans left for a negative angle', () => {
    const config = slantConfig();
    config.slant.angle = -12;

    const [row] = buildSheet(config).rows;
    const [first] = slantOnly(row!);

    expect(first!.start.x).toBeLessThan(baselineAnchor(row!, first!));
  });

  it('draws vertical lines at 0 degrees', () => {
    const config = slantConfig();
    config.slant.angle = 0;

    const [row] = buildSheet(config).rows;

    for (const line of slantOnly(row!)) {
      expect(line.start.x).toBeCloseTo(line.end.x, 10);
    }
  });

  it('clips to the row band and never crosses a row gap', () => {
    const sheet = buildSheet(slantConfig());

    for (const row of sheet.rows) {
      const lines = slantOnly(row);
      expect(lines.length).toBeGreaterThan(0);

      for (const { start, end } of lines) {
        for (const point of [start, end]) {
          expect(point.y).toBeGreaterThanOrEqual(row.top - 1e-9);
          expect(point.y).toBeLessThanOrEqual(row.bottom + 1e-9);
          expect(point.x).toBeGreaterThanOrEqual(row.left - 1e-9);
          expect(point.x).toBeLessThanOrEqual(row.right + 1e-9);
        }
      }
    }
  });

  it('clips the last line where it crosses the right edge', () => {
    const [row] = buildSheet(slantConfig()).rows;
    const last = slantOnly(row!).at(-1)!;

    // Its unclipped top would sit past the right edge, so the top is trimmed
    // short of the ascender line.
    expect(last.start.x).toBeCloseTo(row!.right, 10);
    expect(last.start.y).toBeGreaterThan(row!.top);
    expect(last.end.y).toBeCloseTo(row!.bottom, 10);
  });

  it('repeats the same pattern in every row', () => {
    const sheet = buildSheet(slantConfig());
    const counts = sheet.rows.map((row) => slantOnly(row).length);

    expect(new Set(counts).size).toBe(1);
  });

  it('rejects a non-positive spacing', () => {
    const config = slantConfig();
    config.slant.spacing = 0;

    expect(() => buildSheet(config)).toThrow(/spacing must be greater than 0/);
  });

  it('rejects an angle at or past vertical', () => {
    const config = slantConfig();
    config.slant.angle = 90;

    expect(() => buildSheet(config)).toThrow(/between -90 and 90/);
  });
});
