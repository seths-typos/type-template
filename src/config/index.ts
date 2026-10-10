import { DEFAULTS } from './defaults.js';
import { METRIC_MODES, ORIENTATIONS, VERTICAL_ALIGNMENTS } from './options.js';
import { PAGE_PRESET_NAMES, resolvePageSize } from './presets.js';
import { toCapHeightReference } from './reference.js';
import {
  Issues,
  boolean,
  choice,
  dashArray,
  hexColor,
  number,
  section,
  text,
} from './validate.js';
import type {
  HeaderConfig,
  LabelsConfig,
  LineStyle,
  LinesConfig,
  MetricsConfig,
  PageConfig,
  SheetConfig,
  SheetInput,
  SlantConfig,
} from './types.js';
import type { Orientation, PagePreset } from './presets.js';

export { DEFAULTS } from './defaults.js';
export { ConfigError } from './errors.js';
export type { ConfigIssue } from './errors.js';
export { PAGE_PRESETS, PAGE_PRESET_NAMES, resolvePageSize } from './presets.js';
export type { Orientation, PagePreset } from './presets.js';
export { toCapHeightReference } from './reference.js';
export { FIELDS } from './fields.js';
export { DEFAULT_FONT_UNITS, fontUnitsToPercent } from './font-units.js';
export type { FontUnitMetrics } from './font-units.js';
export { METRIC_LABELS } from './labels.js';
export { METRIC_MODES, ORIENTATIONS, VERTICAL_ALIGNMENTS } from './options.js';
export type { FieldSpec } from './fields.js';
export type * from './types.js';


export const LINE_NAMES = [
  'baseline',
  'capHeight',
  'xHeight',
  'ascender',
  'descender',
] as const satisfies readonly (keyof LinesConfig)[];

/**
 * Raw user input in, validated config out.
 *
 * Defaults are applied field by field, so anything left out keeps its
 * default and nothing has to be passed wholesale. Problems are collected
 * across the whole input and thrown together as a single ConfigError.
 */
export function resolveConfig(input: SheetInput | Record<string, unknown> = {}): SheetConfig {
  const issues = new Issues();
  const raw = section(input, 'config', issues);

  const config: SheetConfig = {
    page: resolvePage(raw.page, issues),
    header: resolveHeader(raw.header, issues),
    metrics: resolveMetrics(raw.metrics, issues),
    lines: resolveLines(raw.lines, issues),
    labels: resolveLabels(raw.labels, issues),
    slant: resolveSlant(raw.slant, issues),
  };

  // Field-level problems first: cross-field checks on bad values only produce
  // confusing follow-on messages.
  issues.throwIfAny();

  checkPageFits(config, issues);
  issues.throwIfAny();

  return config;
}

function resolvePage(raw: unknown, issues: Issues): PageConfig {
  const page = section(raw, 'page', issues);
  const margins = section(page.margins, 'page.margins', issues);
  const fallback = DEFAULTS.page;

  const size = choice<PagePreset>(
    page.size,
    fallback.size,
    'page.size',
    issues,
    PAGE_PRESET_NAMES,
  );

  const orientation = choice<Orientation>(
    page.orientation,
    fallback.orientation,
    'page.orientation',
    issues,
    ORIENTATIONS,
  );

  return {
    ...resolvePageSize(size, orientation),
    margins: {
      top: number(margins.top, fallback.margins.top, 'page.margins.top', issues, { atLeast: 0 }),
      right: number(margins.right, fallback.margins.right, 'page.margins.right', issues, {
        atLeast: 0,
      }),
      bottom: number(margins.bottom, fallback.margins.bottom, 'page.margins.bottom', issues, {
        atLeast: 0,
      }),
      left: number(margins.left, fallback.margins.left, 'page.margins.left', issues, {
        atLeast: 0,
      }),
    },
  };
}

function resolveHeader(raw: unknown, issues: Issues): HeaderConfig {
  const header = section(raw, 'header', issues);
  const fallback = DEFAULTS.header;

  return {
    enabled: boolean(header.enabled, fallback.enabled, 'header.enabled', issues),
    height: number(header.height, fallback.height, 'header.height', issues, { atLeast: 0 }),
    text: text(header.text, fallback.text, 'header.text', issues),
  };
}

function resolveMetrics(raw: unknown, issues: Issues): MetricsConfig {
  const metrics = section(raw, 'metrics', issues);
  const fallback = DEFAULTS.metrics;

  const referenced = toCapHeightReference({
    capHeight: number(metrics.capHeight, fallback.capHeight, 'metrics.capHeight', issues, {
      above: 0,
    }),
    xHeight: number(metrics.xHeight, fallback.xHeight, 'metrics.xHeight', issues, { above: 0 }),
    ascender: number(metrics.ascender, fallback.ascender, 'metrics.ascender', issues, {
      atLeast: 0,
    }),
    descender: number(metrics.descender, fallback.descender, 'metrics.descender', issues, {
      atMost: 0,
    }),
  });

  // No ordering rules beyond the sign of the descender: the row band follows
  // whichever metrics are there, so a face with no ascender — or caps taller
  // than its ascender — is a sheet, not an error.

  return {
    ...referenced,
    mode: choice(metrics.mode, fallback.mode, 'metrics.mode', issues, METRIC_MODES),
    rowCount: number(metrics.rowCount, fallback.rowCount, 'metrics.rowCount', issues, {
      atLeast: 1,
      integer: true,
    }),
    rowGap: number(metrics.rowGap, fallback.rowGap, 'metrics.rowGap', issues, { atLeast: 0 }),
    verticalAlign: choice(
      metrics.verticalAlign,
      fallback.verticalAlign,
      'metrics.verticalAlign',
      issues,
      VERTICAL_ALIGNMENTS,
    ),
  };
}

function resolveLines(raw: unknown, issues: Issues): LinesConfig {
  const lines = section(raw, 'lines', issues);
  const style = (name: keyof LinesConfig) =>
    resolveLineStyle(lines[name], DEFAULTS.lines[name], `lines.${name}`, issues);

  return {
    baseline: style('baseline'),
    capHeight: style('capHeight'),
    xHeight: style('xHeight'),
    ascender: style('ascender'),
    descender: style('descender'),
  };
}

function resolveLineStyle(
  raw: unknown,
  fallback: LineStyle,
  path: string,
  issues: Issues,
): LineStyle {
  const style = section(raw, path, issues);

  return {
    visible: boolean(style.visible, fallback.visible, `${path}.visible`, issues),
    weight: number(style.weight, fallback.weight, `${path}.weight`, issues, { above: 0 }),
    color: hexColor(style.color, fallback.color, `${path}.color`, issues),
    dash: dashArray(style.dash, fallback.dash, `${path}.dash`, issues),
  };
}

function resolveLabels(raw: unknown, issues: Issues): LabelsConfig {
  const labels = section(raw, 'labels', issues);
  const fallback = DEFAULTS.labels;

  return {
    enabled: boolean(labels.enabled, fallback.enabled, 'labels.enabled', issues),
    size: number(labels.size, fallback.size, 'labels.size', issues, { above: 0 }),
    color: hexColor(labels.color, fallback.color, 'labels.color', issues),
    gap: number(labels.gap, fallback.gap, 'labels.gap', issues, { atLeast: 0 }),
  };
}

function resolveSlant(raw: unknown, issues: Issues): SlantConfig {
  const slant = section(raw, 'slant', issues);
  const fallback = DEFAULTS.slant;
  const enabled = boolean(slant.enabled, fallback.enabled, 'slant.enabled', issues);

  if (enabled && slant.angle === undefined) {
    issues.add('slant.angle', 'is required when slant is enabled — it has no default');
  }

  return {
    enabled,
    // Carries 0 when slant is off; geometry never reads it in that case.
    angle: number(slant.angle, 0, 'slant.angle', issues, { above: -90, below: 90 }),
    spacing: number(slant.spacing, fallback.spacing, 'slant.spacing', issues, { above: 0 }),
    inset: number(slant.inset, fallback.inset, 'slant.inset', issues),
    style: resolveLineStyle(slant.style, fallback.style, 'slant.style', issues),
  };
}

/**
 * Whether the page has room for anything at all. Row fitting stays geometry's
 * problem — this is pure page arithmetic, and catching it here names the
 * field at fault.
 */
function checkPageFits(config: SheetConfig, issues: Issues): void {
  const { width, height, margins } = config.page;
  const headerHeight = config.header.enabled ? config.header.height : 0;

  const across = width - margins.left - margins.right;
  const down = height - margins.top - margins.bottom - headerHeight;

  if (across <= 0) {
    issues.add(
      'page.margins',
      `left and right margins take all ${width} pt of the page width`,
    );
  }

  if (down <= 0) {
    issues.add(
      config.header.enabled ? 'header.height' : 'page.margins',
      `margins${headerHeight ? ' and header' : ''} take all ${height} pt of the page height`,
    );
  }
}
