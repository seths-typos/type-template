import type { SlantConfig } from '../config/types.js';
import type { LineSegment, Point, Row } from './types.js';

/** Guard against a runaway loop if spacing is pathologically small. */
const MAX_SLANT_LINES = 10_000;

/**
 * Slant lines for one row band.
 *
 * The angle is measured from vertical; positive leans right, the way an
 * italic does. Each line is anchored on the baseline at `inset` from the
 * row's left edge, then every `spacing` pt along it, and is clipped to the
 * row band — ascender line to descender line, left edge to right edge.
 * Lines do not cross row gaps.
 */
export function slantLines(row: Row, slant: SlantConfig): LineSegment[] {
  if (!slant.enabled) return [];

  if (!(slant.spacing > 0)) {
    throw new Error(`Slant spacing must be greater than 0, got ${slant.spacing}.`);
  }

  if (!(Math.abs(slant.angle) < 90)) {
    throw new Error(
      `Slant angle must be between -90 and 90 degrees from vertical, got ${slant.angle}.`,
    );
  }

  const tan = Math.tan((slant.angle * Math.PI) / 180);
  /** x of the line through `anchorX` on the baseline, at height y. */
  const xAt = (anchorX: number, y: number) => anchorX + (row.baseline - y) * tan;

  const lines: LineSegment[] = [];

  for (let i = 0; i < MAX_SLANT_LINES; i++) {
    const anchorX = row.left + slant.inset + i * slant.spacing;
    const topX = xAt(anchorX, row.top);
    const bottomX = xAt(anchorX, row.bottom);

    // Anchors only move right, so once the whole line clears the right edge
    // every later one does too.
    if (Math.min(topX, bottomX) > row.right) break;

    const clipped = clipToXRange(
      { x: topX, y: row.top },
      { x: bottomX, y: row.bottom },
      row.left,
      row.right,
    );

    if (clipped) {
      lines.push({ start: clipped[0], end: clipped[1], type: 'slant' });
    }
  }

  return lines;
}

/**
 * Clip a segment to a vertical band of x values, returning null if it falls
 * entirely outside. The segment already spans exactly the row's y range, so
 * only x needs clipping.
 */
function clipToXRange(
  start: Point,
  end: Point,
  left: number,
  right: number,
): [Point, Point] | null {
  const dx = end.x - start.x;

  let t0 = 0;
  let t1 = 1;

  // Liang-Barsky, x bounds only.
  for (const [p, q] of [
    [-dx, start.x - left],
    [dx, right - start.x],
  ] as const) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }

    const r = q / p;

    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  const at = (t: number): Point => ({
    x: start.x + t * dx,
    y: start.y + t * (end.y - start.y),
  });

  return [at(t0), at(t1)];
}
