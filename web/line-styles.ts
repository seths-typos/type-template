import type { LineStyle, MetricLine } from '../src/index.js';
import { createChoiceToggle, createStopSlider, nameClass } from './sheet-controls.js';

/** Every line the sheet draws: the five metric lines and the slant lines. */
export type StyledLine = MetricLine | 'slant';

export type LineWeight = 1 | 2 | 3;

/** One line's look, as the panel offers it. Shared by every row. */
export interface LineChoice {
  weight: LineWeight;
  dashed: boolean;
  color: string;
}

export type LineStyles = Record<StyledLine, LineChoice>;

/** The lines in the panel's order, top of the band to bottom, then slant. */
export const STYLED_LINES: { type: StyledLine; name: string }[] = [
  { type: 'ascender', name: 'Ascender' },
  { type: 'capHeight', name: 'Cap height' },
  { type: 'xHeight', name: 'X-height' },
  { type: 'baseline', name: 'Baseline' },
  { type: 'descender', name: 'Descender' },
  { type: 'slant', name: 'Slant' },
];

/**
 * The three colours on offer: --color-black, --color-red and
 * --color-near-black in tokens.css. Hex here because config takes hex.
 */
export const LINE_COLORS: { value: string; name: string }[] = [
  { value: '#132322', name: 'Black' },
  { value: '#cb0106', name: 'Red' },
  { value: '#474848', name: 'Grey' },
];

/** Printed weight in points for each step. Thin is the engine's 0.5 pt. */
const WEIGHT_PT: Record<LineWeight, number> = { 1: 0.5, 2: 1, 3: 1.5 };

/** The engine's x-height dash. */
const DASH = [3, 3];

/**
 * The engine's defaults, as near as the panel can say them: x-height red and
 * dashed, the rest grey and solid, all thin. Slant's default grey (#999999)
 * isn't on offer, so it starts as the other lines' grey.
 */
export function defaultLineStyles(): LineStyles {
  const plain = (): LineChoice => ({ weight: 1, dashed: false, color: '#474848' });
  return {
    ascender: plain(),
    capHeight: plain(),
    xHeight: { weight: 1, dashed: true, color: '#cb0106' },
    baseline: plain(),
    descender: plain(),
    slant: plain(),
  };
}

/** A choice as config's `LineStyle`, less `visible`, which each row owns. */
export function toLineStyle(choice: LineChoice): Omit<LineStyle, 'visible'> {
  return {
    weight: WEIGHT_PT[choice.weight],
    color: choice.color,
    dash: choice.dashed ? [...DASH] : null,
  };
}

export interface LineStylesPanelOptions {
  /** Edited in place; the panel reports each change through `onChange`. */
  styles: LineStyles;
  onChange: () => void;
}

const WEIGHT_STOPS = [
  { value: 1, label: 'Thin' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Thick' },
];

/**
 * "Line Styles": framed and titled like a row editor, a column for each
 * line. Each column names its line over a rule, then sets its weight, dash
 * and colour, the three controls one width.
 *
 * The controls' own names ("Weight", "Stroke", "Colour") would repeat six
 * times over, so they're for screen readers only; each column is a group
 * named by its line.
 */
export function createLineStylesPanel(options: LineStylesPanelOptions): HTMLElement {
  const { styles, onChange } = options;

  const panel = document.createElement('section');
  panel.className = 'line-styles frame';

  const title = document.createElement('h3');
  title.className = 'heading-h3 frame-title';
  title.textContent = 'Line Styles';

  const columns = document.createElement('div');
  columns.className = 'line-columns';

  for (const { type, name } of STYLED_LINES) {
    const choice = styles[type];
    const nameId = `line-styles-${type}`;

    const column = document.createElement('div');
    column.className = 'line-column';
    column.setAttribute('role', 'group');
    column.setAttribute('aria-labelledby', nameId);

    // The column's header: its name, underlined.
    const heading = document.createElement('span');
    heading.className = 'line-column-name';
    heading.id = nameId;
    heading.textContent = name;

    const rule = document.createElement('span');
    rule.className = 'line-column-rule';
    rule.setAttribute('aria-hidden', 'true');

    const head = document.createElement('div');
    head.className = 'ui-sm line-column-head';
    head.append(heading, rule);

    const weight = createStopSlider(
      'Weight',
      WEIGHT_STOPS,
      choice.weight,
      (value) => {
        choice.weight = value as LineWeight;
        onChange();
      },
      { fluid: true, hideName: true },
    );

    const dash = createChoiceToggle(
      'Stroke',
      [
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
      ],
      choice.dashed ? 'dashed' : 'solid',
      (value) => {
        choice.dashed = value === 'dashed';
        onChange();
      },
      { hideName: true },
    );

    const controls = document.createElement('div');
    controls.className = 'line-column-controls';
    controls.append(weight, dash, createColorPicker(choice, onChange));

    column.append(head, controls);
    columns.append(column);
  }

  panel.append(title, columns);
  return panel;
}

let nextId = 0;

/** Three swatches, as radio buttons named by colour. */
function createColorPicker(choice: LineChoice, onChange: () => void): HTMLElement {
  const id = `line-color-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control';
  control.setAttribute('role', 'radiogroup');
  control.setAttribute('aria-labelledby', id);

  const label = document.createElement('span');
  label.className = nameClass({ hideName: true });
  label.id = id;
  label.textContent = 'Colour';

  const swatches = document.createElement('div');
  swatches.className = 'swatches';

  for (const { value, name } of LINE_COLORS) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.className = 'swatch';
    radio.name = id;
    radio.value = value;
    radio.checked = value === choice.color;
    radio.setAttribute('aria-label', name);
    radio.style.setProperty('--swatch', value);
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      choice.color = value;
      onChange();
    });
    swatches.append(radio);
  }

  control.append(label, swatches);
  return control;
}
