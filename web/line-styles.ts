import type { LineStyle, MetricLine } from '../src/index.js';
import { createChoiceToggle, createStopSlider } from './sheet-controls.js';

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

/**
 * "Line Styles": a black block cut like the row editors, its title inside.
 * Pick a line on the left and set its weight, dash and colour on the right,
 * across a rule that each line's name runs into.
 */
export function createLineStylesPanel(options: LineStylesPanelOptions): HTMLElement {
  const { styles, onChange } = options;
  let current: StyledLine = STYLED_LINES[0]!.type;

  const panel = document.createElement('section');
  panel.className = 'line-styles frame';

  const title = document.createElement('h3');
  title.className = 'heading-h3 frame-title';
  title.textContent = 'Line Styles';

  const picker = document.createElement('div');
  picker.className = 'line-picker';
  picker.setAttribute('role', 'radiogroup');
  picker.setAttribute('aria-label', 'Line');

  for (const { type, name } of STYLED_LINES) {
    const option = document.createElement('label');
    option.className = 'line-option ui-sm';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'line-styles-line';
    radio.value = type;
    radio.checked = type === current;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      current = type;
      showControls();
    });

    const text = document.createElement('span');
    text.className = 'line-name';
    text.textContent = name;

    option.append(radio, text);
    picker.append(option);
  }

  const controls = document.createElement('div');
  controls.className = 'line-controls';


  /** The controls for the line picked, rebuilt each time the pick changes. */
  function showControls(): void {
    const choice = styles[current];

    const weight = createStopSlider(
      'Weight',
      [
        { value: 1, label: 'Thin' },
        { value: 2, label: 'Medium' },
        { value: 3, label: 'Thick' },
      ],
      choice.weight,
      (value) => {
        choice.weight = value as LineWeight;
        onChange();
      },
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
    );

    controls.replaceChildren(weight, dash, createColorPicker(choice, onChange));
  }

  showControls();

  const body = document.createElement('div');
  body.className = 'line-styles-body';
  body.append(picker, controls);

  panel.append(title, body);
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
  label.className = 'ui-sm sheet-control-name';
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
