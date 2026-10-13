import type { SheetConfig } from '../config/types.js';
import type { HeaderBlock, Rect, Sheet } from './types.js';
import { fitRowCount, solveCapHeight, totalMetricHeight } from './metrics.js';
import { buildRows, type RowLayout } from './rows.js';

/** Slack below this is float noise, not space worth distributing. */
const EPSILON = 1e-9;

/**
 * Validated config in, coordinates out. Pure — no PDF awareness, no I/O.
 *
 * Output origin is the top-left of the page, y increasing downward.
 */
export function buildSheet(config: SheetConfig): Sheet {
  const page = pageSize(config);
  const header = headerBlock(config, page);
  const area = availableArea(config, page);

  const layout = resolveLayout(config, area);
  const rows = buildRows(area, layout, config.metrics, config.slant);

  return {
    page,
    area,
    header,
    capHeight: layout.capHeight,
    totalMetricHeight: layout.totalMetricHeight,
    rowPitch: layout.totalMetricHeight + layout.gap,
    rows,
  };
}

/** Config hands geometry resolved dimensions — presets are config's business. */
function pageSize(config: SheetConfig): { width: number; height: number } {
  const { width, height } = config.page;

  if (!(width > 0) || !(height > 0)) {
    throw new Error(`Page must have positive dimensions, got ${width} x ${height} pt.`);
  }

  return { width, height };
}

/** Inside the margins, below the header. */
function availableArea(config: SheetConfig, page: { width: number; height: number }): Rect {
  const { margins } = config.page;
  const headerHeight = config.header.enabled ? config.header.height : 0;

  const top = margins.top + headerHeight;
  const right = page.width - margins.right;
  const bottom = page.height - margins.bottom;
  const left = margins.left;

  const width = right - left;
  const height = bottom - top;

  if (!(width > 0) || !(height > 0)) {
    throw new Error(
      `Margins${headerHeight ? ' and header' : ''} leave no room on a ` +
        `${page.width} x ${page.height} pt page (got ${width} x ${height} pt).`,
    );
  }

  return { top, right, bottom, left, width, height };
}

function headerBlock(
  config: SheetConfig,
  page: { width: number; height: number },
): HeaderBlock | null {
  if (!config.header.enabled) return null;

  const { margins } = config.page;

  return {
    x: margins.left,
    y: margins.top,
    width: page.width - margins.left - margins.right,
    height: config.header.height,
    left: config.header.left,
    center: config.header.center,
    right: config.header.right,
  };
}

/** Resolve cap height, row count, and where the block of rows starts. */
function resolveLayout(config: SheetConfig, area: Rect): RowLayout {
  const { metrics } = config;

  const capHeight =
    metrics.mode === 'rowCount'
      ? solveCapHeight(area.height, metrics.rowCount, metrics.rowGap, metrics)
      : metrics.capHeight;

  const height = totalMetricHeight(capHeight, metrics);

  const rowCount =
    metrics.mode === 'rowCount'
      ? metrics.rowCount
      : fitRowCount(area.height, height, metrics.rowGap);

  if (rowCount < 1) {
    throw new Error(
      `No rows fit: one row is ${round(height)} pt tall but only ` +
        `${round(area.height)} pt is available.`,
    );
  }

  return { capHeight, totalMetricHeight: height, rowCount, ...align(config, area, height, rowCount) };
}

/** Where the block starts, and the gap actually used between rows. */
function align(
  config: SheetConfig,
  area: Rect,
  height: number,
  rowCount: number,
): { blockTop: number; gap: number } {
  const { rowGap, verticalAlign } = config.metrics;

  // With a single row there are no gaps to distribute, so justify is top.
  if (verticalAlign === 'justify' && rowCount > 1) {
    const slack = area.height - (rowCount * height + (rowCount - 1) * rowGap);

    // rowCount mode already fills the area exactly. Widening rowGap by a
    // correction, rather than resolving the gap from scratch, leaves it
    // untouched there instead of nudging it by a float's width.
    if (slack > EPSILON) {
      return { blockTop: area.top, gap: rowGap + slack / (rowCount - 1) };
    }
  }

  if (verticalAlign === 'center') {
    const blockHeight = rowCount * height + (rowCount - 1) * rowGap;
    return { blockTop: area.top + (area.height - blockHeight) / 2, gap: rowGap };
  }

  return { blockTop: area.top, gap: rowGap };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
