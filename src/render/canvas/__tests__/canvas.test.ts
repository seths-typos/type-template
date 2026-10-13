import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../../geometry/index.js';
import { baseConfig } from '../../../testing/fixtures.js';
import { drawSheetToCanvas, toCss, type Canvas2D } from '../index.js';
import type { SheetConfig } from '../../../config/types.js';

type Call = { op: string; args: unknown[] };

/** A context that records what it was asked to draw — no DOM needed. */
function recorder(): Canvas2D & { calls: Call[] } {
  const calls: Call[] = [];
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
    };

  return {
    calls,
    save: record('save'),
    restore: record('restore'),
    scale: record('scale'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    fillText: record('fillText'),
    setLineDash: record('setLineDash'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
}

function render(config: SheetConfig, options = {}) {
  const ctx = recorder();
  drawSheetToCanvas(ctx, buildSheet(config), config, options);

  return ctx;
}

const ofType = (ctx: { calls: Call[] }, op: string) => ctx.calls.filter((call) => call.op === op);

describe('drawSheetToCanvas', () => {
  it('paints the page before drawing on it', () => {
    const ctx = render(baseConfig());
    const [fill] = ofType(ctx, 'fillRect');

    expect(fill!.args).toEqual([0, 0, 792, 612]);
    expect(ctx.calls[0]!.op).toBe('save');
    expect(ctx.calls.at(-1)!.op).toBe('restore');
  });

  it('strokes one path per visible line', () => {
    const config = baseConfig();
    const sheet = buildSheet(config);

    expect(ofType(render(config), 'stroke')).toHaveLength(sheet.rows.length * 5);
  });

  it('drops a stroke for every line switched off', () => {
    const config = baseConfig();
    config.lines.xHeight.visible = false;

    const sheet = buildSheet(config);

    expect(ofType(render(config), 'stroke')).toHaveLength(sheet.rows.length * 4);
  });

  it('draws in geometry space, with no flip', () => {
    const ctx = render(baseConfig());
    const [first] = ofType(ctx, 'moveTo');

    // Row 0's ascender line: 36 pt from the left and 36 pt from the top.
    expect(first!.args[0]).toBe(36);
    expect(first!.args[1] as number).toBeCloseTo(36, 10);
  });

  it('draws the labels', () => {
    const ctx = render(baseConfig());
    const drawn = ofType(ctx, 'fillText').map((call) => call.args[0]);

    expect(new Set(drawn)).toEqual(new Set(['B', 'C', 'X']));
  });

  it('draws header text at the top of the reserved block', () => {
    const config = baseConfig();
    config.header.enabled = true;
    config.header.left = 'brief';
    config.labels.enabled = false;

    const [text] = ofType(render(config), 'fillText');

    expect(text!.args).toEqual(['brief', 36, 48]);
  });

  it('applies the scale rather than baking it into the coordinates', () => {
    const ctx = render(baseConfig(), { scale: 2 });
    const [scale] = ofType(ctx, 'scale');
    const [first] = ofType(ctx, 'moveTo');

    expect(scale!.args).toEqual([2, 2]);
    expect(first!.args[0]).toBe(36);
    expect(first!.args[1] as number).toBeCloseTo(36, 10);
  });

  it('sets a dash pattern for dashed styles and clears it for solid ones', () => {
    const patterns = ofType(render(baseConfig()), 'setLineDash').map((call) => call.args[0]);

    expect(patterns).toContainEqual([3, 3]);
    expect(patterns).toContainEqual([]);
  });
});

describe('toCss', () => {
  it('turns 0–1 components into a css colour', () => {
    expect(toCss({ r: 0, g: 0, b: 0 })).toBe('rgb(0, 0, 0)');
    expect(toCss({ r: 1, g: 1, b: 1 })).toBe('rgb(255, 255, 255)');
    expect(toCss({ r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 })).toBe('rgb(136, 136, 136)');
  });
});
