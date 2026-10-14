import { ConfigError, DEFAULT_FONT_UNITS, fontUnitsToPercent, resolveConfig } from '../src/index.js';
import type { FontUnitMetrics, MetricLine, SheetInput } from '../src/index.js';
import type { LabelText } from '../src/render/ops.js';
import { toLineStyle, type LineStyles } from './line-styles.js';
import { metricOrderErrors } from './metric-order.js';

/**
 * What a row's controls hold. Values stay as typed — font units and degrees —
 * and go through config to become a sheet, so a bad value is caught there,
 * named against its field, and never reaches the preview. Null is text that
 * isn't a number.
 */
export type RowState = {
  units: Record<keyof FontUnitMetrics, number | null>;
  visible: Record<MetricLine, boolean>;
  slant: { enabled: boolean; angle: number | null };
};

export function newRowState(): RowState {
  return {
    units: { ...DEFAULT_FONT_UNITS },
    visible: { ascender: true, capHeight: true, xHeight: true, baseline: true, descender: true },
    // The engine has no default angle, so the italic angle starts at 30°.
    slant: { enabled: true, angle: 30 },
  };
}

export function copyRowState(state: RowState): RowState {
  return {
    units: { ...state.units },
    visible: { ...state.visible },
    slant: { ...state.slant },
  };
}

/**
 * The row as engine input, recording any problems against their fields.
 * Null when the metrics can't be drawn. A bad italic angle alone doesn't
 * stop the row: it comes back without slant lines, the error still
 * recorded.
 *
 * Input, not resolved config, so a caller can add to it — the sheet preview
 * sets the page and row count — and resolve it once. Every input returned
 * here is known to resolve.
 */
export function rowInput(
  state: RowState,
  styles: LineStyles,
  errors: Map<string, string> = new Map(),
): SheetInput | null {
  for (const [key, value] of Object.entries(state.units)) {
    if (value === null) errors.set(`metrics.${key}`, 'Enter a number.');
  }
  const slantTyped = !state.slant.enabled || state.slant.angle !== null;
  if (!slantTyped) errors.set('slant.angle', 'Enter a number.');
  if ([...errors.keys()].some((path) => path.startsWith('metrics.'))) return null;

  const units = state.units as FontUnitMetrics;
  // Everything else is measured against the cap height, so config can't
  // judge the others until it is usable.
  if (!(units.capHeight > 0)) {
    errors.set('metrics.capHeight', 'Must be greater than 0.');
    return null;
  }

  // Out of order, the row is left undrawn like any other bad metric.
  const disorder = metricOrderErrors(units, state.visible);
  if (disorder.size > 0) {
    for (const [path, message] of disorder) errors.set(path, message);
    return null;
  }

  const line = (type: MetricLine) => ({ ...toLineStyle(styles[type]), visible: state.visible[type] });
  const input = {
    metrics: fontUnitsToPercent(units),
    lines: {
      ascender: line('ascender'),
      capHeight: line('capHeight'),
      xHeight: line('xHeight'),
      baseline: line('baseline'),
      descender: line('descender'),
    },
  };
  const slantOff = { enabled: false };
  const withSlant: SheetInput = {
    ...input,
    slant:
      state.slant.enabled && slantTyped
        ? { enabled: true, angle: state.slant.angle!, style: toLineStyle(styles.slant) }
        : slantOff,
  };

  try {
    resolveConfig(withSlant);
    return withSlant;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    for (const { path, message } of error.issues) {
      // The only way an angle that parsed can fail is its range.
      errors.set(path, path === 'slant.angle' ? ANGLE_RANGE : describe(message));
    }

    // Only the angle was wrong: draw the row without its slant lines.
    if (error.issues.every(({ path }) => path.startsWith('slant.'))) {
      return { ...input, slant: slantOff };
    }
    return null;
  }
}

/** Config's range is open: ±90° would be a flat line, so 90 is out. */
const ANGLE_RANGE = 'Use an angle between −90° and 90°.';

/**
 * Config's message as the field should show it. Its ", got …" names the value
 * config saw — a percentage of cap height for the font-unit fields, not what
 * was typed — so it is dropped. The sign is unchanged by the conversion, so
 * the rule itself still holds.
 */
function describe(message: string): string {
  const rule = message.replace(/, got .*$/, '');
  return `${rule[0]!.toUpperCase()}${rule.slice(1)}.`;
}

/**
 * Each metric line's value as the sheet labels it: the font units typed,
 * and 0 for the baseline. Hyphen-minus, not the minus sign: the PDF's
 * standard Helvetica can't encode U+2212.
 */
export function rowValues(state: RowState): LabelText {
  const text = (value: number | null) => (value === null ? undefined : String(value));
  return {
    ascender: text(state.units.ascender),
    capHeight: text(state.units.capHeight),
    xHeight: text(state.units.xHeight),
    baseline: '0',
    descender: text(state.units.descender),
  };
}
