import { describe, expect, it } from 'vitest';
import { availableWidth, previewSize, type Box } from '../preview.js';

const PAGE = { width: 792, height: 612 };
const PADDING = 16;
/** What the grid column gives the preview when nothing is forcing it wider. */
const COLUMN = 568;

/**
 * Render repeatedly into a container that grows to fit its content, which is
 * what a grid item with the default `min-width: auto` does. A sizing rule that
 * overflows its container feeds itself and the canvas creeps on every edit.
 */
function repeatedRenders(measure: (box: Box) => number, passes: number): number[] {
  let content = COLUMN;

  return Array.from({ length: passes }, () => {
    const available = measure({
      clientWidth: content + PADDING * 2,
      paddingLeft: PADDING,
      paddingRight: PADDING,
    });

    content = Math.max(COLUMN, available);

    return previewSize(available, PAGE, 1).width;
  });
}

describe('preview sizing', () => {
  it('stays the same size however many times it renders', () => {
    const widths = repeatedRenders(availableWidth, 5);

    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(COLUMN);
  });

  it('would creep if it measured the padded box instead', () => {
    // The bug: clientWidth includes padding, so the canvas overflowed by 32 pt,
    // the column grew to fit it, and the next render measured the bigger box.
    const widths = repeatedRenders((box) => box.clientWidth, 5);

    expect(widths[1]! - widths[0]!).toBe(PADDING * 2);
    expect(widths.at(-1)!).toBeGreaterThan(widths[0]!);
  });

  it('excludes padding from the content box', () => {
    expect(availableWidth({ clientWidth: 600, paddingLeft: 16, paddingRight: 16 })).toBe(568);
  });

  it('never goes negative on a collapsed container', () => {
    expect(availableWidth({ clientWidth: 10, paddingLeft: 16, paddingRight: 16 })).toBe(0);
  });

  it('keeps the page aspect ratio', () => {
    const { width, height } = previewSize(COLUMN, PAGE, 1);

    expect(width / height).toBeCloseTo(PAGE.width / PAGE.height, 2);
  });

  it('puts the device pixel ratio in the backing store, not the layout', () => {
    const single = previewSize(COLUMN, PAGE, 1);
    const retina = previewSize(COLUMN, PAGE, 2);

    expect(retina.width).toBe(single.width * 2);
    expect(retina.scale).toBe(single.scale * 2);
  });
});
