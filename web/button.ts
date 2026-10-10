import { DEFAULT_FONT_UNITS } from '../src/index.js';
import type { MetricLine } from '../src/index.js';

let nextId = 0;

/** The value field a toggle slides out when it is on. */
export interface MetricField {
  value: number;
  /** Shown in the cap at the field's right end. */
  unit: string;
}

export interface MetricToggleOptions {
  name: string;
  on: boolean;
  field?: MetricField;
  /** The button was pressed; `on` is the new state. */
  onToggle?: (on: boolean) => void;
  /**
   * The field was edited. `value` is the parsed number, or null when the text
   * is not a number at all.
   */
  onValue?: (value: number | null) => void;
}

export interface MetricToggle {
  /** The toggle, with the line under it that says what's wrong, if anything. */
  element: HTMLElement;
  /** Mark the field invalid with a message, or clear it with null. */
  setError(message: string | null): void;
  /**
   * Show a state set elsewhere, without reporting it back: on or off, and the
   * field's value. A null value leaves the field's text as it is.
   */
  set(on: boolean, value: number | null): void;
}

/**
 * An on/off toggle for one metric line: the metric's name, then a small
 * square button with its bottom-left corner cut, the name centred on it. A
 * rule runs over the name and along the button's top. Off is the button
 * outlined, reading OFF; on is it filled, reading ON.
 *
 * Given a `field`, turning it on slides a value field out of the button to
 * the right — the rule carries on as its top edge — and turning it off slides
 * the field back in. Space for the field is reserved either way, so buttons
 * stay lined up down a column whatever state their neighbours are in.
 *
 * The button is named by the metric label and carries its state in
 * `aria-pressed`, so the ON/OFF text is visual only.
 */
export function createMetricToggle(options: MetricToggleOptions): MetricToggle {
  const { name, on, field, onToggle = () => {}, onValue = () => {} } = options;
  const id = `metric-toggle-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'metric-toggle ui-sm';

  // A real label: clicking the name presses the button, as clicking the
  // button itself does.
  const label = document.createElement('label');
  label.className = 'metric-toggle-name';
  label.id = id;
  label.htmlFor = `${id}-button`;
  label.textContent = name;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = `${id}-button`;
  button.className = 'toggle';
  button.setAttribute('aria-labelledby', id);

  const state = document.createElement('span');
  state.setAttribute('aria-hidden', 'true');
  button.append(state);

  const switcher = document.createElement('div');
  switcher.className = 'metric-control';
  switcher.append(button);

  let drawer: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  if (field) {
    const clip = document.createElement('div');
    clip.className = 'metric-drawer-clip';

    drawer = document.createElement('div');
    drawer.className = 'metric-drawer';

    input = document.createElement('input');
    input.className = 'metric-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = String(field.value);
    input.setAttribute('aria-label', `${name} (${field.unit})`);
    input.addEventListener('input', () => {
      const text = input!.value.trim();
      const value = text === '' ? NaN : Number(text);
      onValue(Number.isFinite(value) ? value : null);
    });

    const unit = document.createElement('span');
    unit.className = 'metric-unit';
    unit.setAttribute('aria-hidden', 'true');
    // In its own box so it can be trimmed to its capitals like ON/OFF, which
    // puts the two on one baseline.
    const unitText = document.createElement('span');
    unitText.textContent = field.unit;
    unit.append(unitText);

    drawer.append(input, unit);
    clip.append(drawer);
    switcher.append(clip);
  }

  const show = (value: boolean) => {
    button.setAttribute('aria-pressed', String(value));
    state.textContent = value ? 'On' : 'Off';
    // A closed drawer is out of sight, so keep it out of the tab order too.
    drawer?.toggleAttribute('inert', !value);
  };
  show(on);

  button.addEventListener('click', () => {
    const value = button.getAttribute('aria-pressed') !== 'true';
    show(value);
    onToggle(value);
  });

  control.append(label, switcher);

  // The error sits right under its own field, and is read out with it.
  const error = document.createElement('p');
  error.className = 'metric-error ui-xs';
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  input?.setAttribute('aria-describedby', error.id);

  const item = document.createElement('div');
  item.className = 'metric-item';
  item.append(control, error);

  return {
    element: item,
    setError(message) {
      if (!input) return;
      error.textContent = message ?? '';
      // An empty aria-invalid reads as false, so set "true" outright.
      if (message === null) input.removeAttribute('aria-invalid');
      else input.setAttribute('aria-invalid', 'true');
    },
    set(on, value) {
      show(on);
      if (input && value !== null) input.value = String(value);
    },
  };
}

/**
 * Each toggle, top of the row to bottom, with the field it slides out. Values
 * are font units, as Glyphs, RoboFont and FontLab take them: height above the
 * baseline, the descender negative. The baseline has no toggle — it is the
 * zero every other metric is measured from, and it is always drawn.
 */
export const METRIC_TOGGLES: { type: MetricLine; name: string; field: MetricField }[] = [
  { type: 'ascender', name: 'Ascender', field: { value: DEFAULT_FONT_UNITS.ascender, unit: 'Units' } },
  { type: 'capHeight', name: 'Cap height', field: { value: DEFAULT_FONT_UNITS.capHeight, unit: 'Units' } },
  { type: 'xHeight', name: 'X-height', field: { value: DEFAULT_FONT_UNITS.xHeight, unit: 'Units' } },
  { type: 'descender', name: 'Descender', field: { value: DEFAULT_FONT_UNITS.descender, unit: 'Units' } },
];
