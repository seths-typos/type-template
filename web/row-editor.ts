import { ConfigError, DEFAULT_FONT_UNITS, fontUnitsToPercent, resolveConfig } from '../src/index.js';
import type { FontUnitMetrics, MetricLine, SheetConfig } from '../src/index.js';
import { METRIC_TOGGLES, createMetricToggle, type MetricToggle } from './button.js';
import { toLineStyle, type LineStyles } from './line-styles.js';
import { metricOrderErrors } from './metric-order.js';
import { renderRowPreview } from './row-preview.js';

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

export interface RowEditorOptions {
  /** 1-based, as the user counts them. */
  row: number;
  /** The metrics this row draws. Rows sharing metrics share this object. */
  state: RowState;
  /** How each line is drawn, shared by every row. Read on each redraw. */
  styles: LineStyles;
  /** The state was changed through this row's controls; the row has redrawn. */
  onChange: () => void;
}

export interface RowEditor {
  element: HTMLElement;
  /** Draw a different state, its values shown in the controls. */
  setState(state: RowState): void;
  /** Show the controls' values from the state, and redraw. */
  sync(): void;
  /**
   * In use, or past the row count: dimmed and every control disabled. With
   * `animate`, the preview powers on or off like a screen rather than
   * switching at once.
   */
  setActive(active: boolean, animate?: boolean): void;
  /** Whether the metrics can be edited here, or follow another row's. */
  setMetricsEditable(editable: boolean): void;
}

/**
 * One row's editor: its preview, then the toggles that drive it, framed.
 *
 * A fieldset, as is its Metrics section, so a row — or just its metrics —
 * can be disabled in one step: every control inside goes disabled, and
 * stays readable to assistive tech as such.
 */
export function createRowEditor(options: RowEditorOptions): RowEditor {
  const { row, styles, onChange } = options;
  let state = options.state;

  const editor = document.createElement('fieldset');
  editor.className = 'editor frame';
  const metrics = document.createElement('fieldset');
  metrics.className = 'row-section';
  const controls = document.createElement('div');
  controls.className = 'metric-controls';
  metrics.append(controls);
  editor.append(metrics);

  /** Each field's toggle, keyed by the config path its errors come back on. */
  const byPath = new Map<string, MetricToggle>();
  /** Each metric's toggle, to show a state set elsewhere. */
  const byType = new Map<MetricLine, MetricToggle>();

  const changed = () => {
    refresh();
    onChange();
  };

  for (const { type, name, field } of METRIC_TOGGLES) {
    const toggle = createMetricToggle({
      name,
      on: state.visible[type],
      field: { ...field, value: state.units[type as keyof FontUnitMetrics] ?? field.value },
      onToggle(on) {
        state.visible[type] = on;
        changed();
      },
      onValue(value) {
        state.units[type as keyof FontUnitMetrics] = value;
        changed();
      },
    });
    byPath.set(`metrics.${type}`, toggle);
    byType.set(type, toggle);
    controls.append(toggle.element);
  }

  const italic = createMetricToggle({
    name: 'Italic angle',
    on: state.slant.enabled,
    field: { value: state.slant.angle ?? 30, unit: 'Deg' },
    onToggle(on) {
      state.slant.enabled = on;
      changed();
    },
    onValue(value) {
      state.slant.angle = value;
      changed();
    },
  });
  byPath.set('slant.angle', italic);
  controls.append(italic.element);

  let preview: HTMLElement | null = null;
  /**
   * Past the row count. The row then shows every metric off and an empty
   * card, but its state is kept, so raising the count brings it back as it
   * was.
   */
  let inactive = false;
  /** The lines are fading out; the empty card waits until they have. */
  let poweringOff = false;

  /** Rebuild the preview from the state, or flag what stops it. */
  function refresh(): void {
    if (inactive) {
      for (const toggle of byPath.values()) toggle.setError(null);
      if (!poweringOff) show(EMPTY_ROW);
      return;
    }

    const errors = new Map<string, string>();
    const config = toConfig(state, styles, errors);

    // Errors belong to the row being edited; a row following another's
    // metrics shows them only on that row.
    const editable = !metrics.disabled;
    for (const [path, toggle] of byPath) {
      toggle.setError(editable ? (errors.get(path) ?? null) : null);
    }

    // A bad metric leaves the last good preview standing, faded, so it can't
    // be mistaken for the values now in the fields. A bad angle doesn't get
    // this far: the preview just drops its slant lines.
    if (!config) {
      preview?.classList.add('is-stale');
      return;
    }

    show(config);
  }

  function show(config: SheetConfig): void {
    // The card spans the toggle column.
    const next = renderRowPreview(config, row, controls.getBoundingClientRect().width);
    // The preview heads the editor, above its controls.
    if (preview) preview.replaceWith(next);
    else editor.prepend(next);
    preview = next;
  }

  function sync(): void {
    for (const [type, toggle] of byType) {
      toggle.set(!inactive && state.visible[type], state.units[type as keyof FontUnitMetrics]);
    }
    italic.set(!inactive && state.slant.enabled, state.slant.angle);
    refresh();
  }

  refresh();

  // The web fonts change how wide the names set, so the column — and the
  // card with it — settles once they load, and again whenever it resizes.
  new ResizeObserver(() => refresh()).observe(controls);

  return {
    element: editor,
    setState(next) {
      state = next;
      sync();
    },
    sync,
    setActive(active, animate = false) {
      const changed = inactive === active;
      inactive = !active;
      editor.disabled = !active;
      editor.classList.toggle('is-inactive', !active);

      const power = animate && changed && !REDUCED_MOTION.matches;
      if (power && !active && preview) {
        // Off: fade the lines still showing, then leave the card empty.
        const fading = preview;
        poweringOff = true;
        fading.querySelector('.row-preview')?.classList.add('is-powering-off');
        fading.addEventListener(
          'animationend',
          () => {
            poweringOff = false;
            // Only if it is still the card showing and the row is still off.
            if (inactive && preview === fading) show(EMPTY_ROW);
          },
          { once: true },
        );
        sync();
        return;
      }

      poweringOff = false;
      sync();
      // On: the freshly drawn lines flicker up.
      if (power && active) preview?.querySelector('.row-preview')?.classList.add('is-powering-on');
    },
    setMetricsEditable(editable) {
      metrics.disabled = !editable;
      metrics.classList.toggle('is-following', !editable);
      refresh();
    },
  };
}

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

/** A row with nothing drawn: what a row past the count shows. */
const EMPTY_ROW: SheetConfig = resolveConfig({
  lines: {
    ascender: { visible: false },
    capHeight: { visible: false },
    xHeight: { visible: false },
    baseline: { visible: false },
    descender: { visible: false },
  },
  slant: { enabled: false },
});

/**
 * The row as config, recording any problems against their fields. Null when
 * the metrics can't be drawn. A bad italic angle alone doesn't stop the row:
 * it comes back without slant lines, the error still recorded.
 */
function toConfig(
  state: RowState,
  styles: LineStyles,
  errors: Map<string, string>,
): SheetConfig | null {
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
  const slantStyle = toLineStyle(styles.slant);

  try {
    return resolveConfig({
      ...input,
      slant:
        state.slant.enabled && slantTyped
          ? { enabled: true, angle: state.slant.angle!, style: slantStyle }
          : slantOff,
    });
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    for (const { path, message } of error.issues) {
      // The only way an angle that parsed can fail is its range.
      errors.set(path, path === 'slant.angle' ? ANGLE_RANGE : describe(message));
    }

    // Only the angle was wrong: draw the row without its slant lines.
    if (error.issues.every(({ path }) => path.startsWith('slant.'))) {
      return resolveConfig({ ...input, slant: slantOff });
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
