import type { Orientation, PagePreset } from './presets.js';

/**
 * Config schema for the validated config — what geometry and the renderers
 * consume. Page presets live in ./presets.ts.
 *
 * Types only — defaults and validation land here later
 * (build order: geometry, then render/pdf, then config).
 *
 * All lengths are points. 1 pt = 1/72 inch.
 */

export interface LineStyle {
  visible: boolean;
  /** pt */
  weight: number;
  /** hex, e.g. '#000000' */
  color: string;
  /** pdf dash array, null = solid */
  dash: number[] | null;
}

/**
 * Validated page. `size` (a preset name) and `orientation` are input-side
 * fields — config resolves them into these dimensions, so everything
 * downstream sees points and never a preset name.
 */
export interface PageConfig {
  /** pt */
  width: number;
  /** pt */
  height: number;
  /** pt */
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface HeaderConfig {
  enabled: boolean;
  /** pt, reserved below the top margin */
  height: number;
  /** Free text set at the block's left edge, centre and right edge. */
  left: string;
  center: string;
  right: string;
}

export type MetricsMode = 'capHeight' | 'rowCount';

export type VerticalAlign = 'top' | 'center' | 'justify';

export interface MetricsConfig {
  mode: MetricsMode;
  /** pt, absolute. Input in capHeight mode; computed in rowCount mode. */
  capHeight: number;
  /** Input in rowCount mode; computed in capHeight mode. */
  rowCount: number;
  /** % of cap height */
  xHeight: number;
  /** % of cap height, typically > 100 */
  ascender: number;
  /** % of cap height, negative */
  descender: number;
  /** pt, bottom of one row band to the top of the next */
  rowGap: number;
  verticalAlign: VerticalAlign;
}

export interface LinesConfig {
  baseline: LineStyle;
  capHeight: LineStyle;
  xHeight: LineStyle;
  ascender: LineStyle;
  descender: LineStyle;
}

/**
 * Letters in the left margin naming each metric line, so a row is
 * self-describing — which matters most for the ascender and cap height
 * lines, the closest pair on the sheet.
 */
export interface LabelsConfig {
  enabled: boolean;
  /** pt */
  size: number;
  /** hex */
  color: string;
  /** pt, between the label's right edge and the left end of its line */
  gap: number;
}

export interface SlantConfig {
  enabled: boolean;
  /** degrees from vertical. No default — user must set. */
  angle: number;
  /** pt, horizontal distance between lines measured along the baseline */
  spacing: number;
  /** pt, horizontal offset of the first slant line from the left edge of the row */
  inset: number;
  style: LineStyle;
}

export interface SheetConfig {
  page: PageConfig;
  header: HeaderConfig;
  metrics: MetricsConfig;
  lines: LinesConfig;
  labels: LabelsConfig;
  slant: SlantConfig;
}

/**
 * Raw input. Every field is optional — whatever is left out keeps its
 * default. `page.size` and `page.orientation` live here rather than in the
 * validated config, because resolving them into dimensions is config's job.
 */
export interface SheetInput {
  page?: {
    size?: PagePreset;
    orientation?: Orientation;
    margins?: Partial<PageConfig['margins']>;
  };
  header?: Partial<HeaderConfig>;
  metrics?: Partial<MetricsConfig>;
  lines?: Partial<Record<keyof LinesConfig, Partial<LineStyle>>>;
  labels?: Partial<LabelsConfig>;
  slant?: Partial<Omit<SlantConfig, 'style'>> & { style?: Partial<LineStyle> };
}
