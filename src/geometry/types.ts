/**
 * Geometry output.
 *
 * Coordinate origin is the top-left of the page, y increases downward.
 * The renderer is responsible for flipping to PDF's bottom-left origin.
 * All values are points.
 */

export interface Point {
  x: number;
  y: number;
}

/** The five horizontal metric lines, ordered as they appear down a row. */
export type MetricLine = 'ascender' | 'capHeight' | 'xHeight' | 'baseline' | 'descender';

/**
 * Every kind of line the geometry emits. Doubles as the style reference:
 * a metric line resolves to `config.lines[type]`, 'slant' to `config.slant.style`.
 */
export type LineType = MetricLine | 'slant';

export interface LineSegment {
  start: Point;
  end: Point;
  type: LineType;
}

export interface Row {
  /** 0-based, top to bottom. */
  index: number;
  /** y of the ascender line — top of the row band. */
  top: number;
  /** y of the baseline — the row's y = 0 reference. */
  baseline: number;
  /** y of the descender line — bottom of the row band. */
  bottom: number;
  /** x of the left edge of the row band. */
  left: number;
  /** x of the right edge of the row band. */
  right: number;
  lines: LineSegment[];
}

export interface HeaderBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Text for the block's left edge, centre and right edge. */
  left: string;
  center: string;
  right: string;
}

export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface Sheet {
  page: { width: number; height: number };
  /** The area rows are laid into: inside the margins, below the header. */
  area: Rect;
  header: HeaderBlock | null;
  /** Resolved cap height — input in capHeight mode, solved in rowCount mode. */
  capHeight: number;
  /** Ascender line to descender line. */
  totalMetricHeight: number;
  /**
   * totalMetricHeight + the gap actually used between rows. Equals
   * totalMetricHeight + config rowGap except under 'justify', where the
   * leftover space is distributed into the gaps.
   */
  rowPitch: number;
  rows: Row[];
}
