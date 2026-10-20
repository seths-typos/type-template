import type { LineStyle, MetricLine } from '../src/index.js';
import { createChoiceToggle } from './sheet-controls.js';

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
  { type: 'xHeight', name: 'x-height' },
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
 * The engine's defaults, as near as the panel can say them — x-height red
 * and dashed, the rest grey and solid, all thin — but for the baseline,
 * which the page starts heavier, black and medium, as the line letters sit
 * on. Slant's default grey (#999999) isn't on offer, so it starts as the
 * other lines' grey.
 */
export function defaultLineStyles(): LineStyles {
  const plain = (): LineChoice => ({ weight: 1, dashed: false, color: '#474848' });
  return {
    ascender: plain(),
    capHeight: plain(),
    xHeight: { weight: 1, dashed: true, color: '#cb0106' },
    baseline: { weight: 2, dashed: false, color: '#132322' },
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

const WEIGHTS: { value: `${LineWeight}`; label: string }[] = [
  { value: '1', label: 'Thin' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Thick' },
];

/**
 * "Line Styles": a card for each line, framed like an inactive row editor
 * with the line's name set into its top edge. Each card sets the line's
 * weight, dash and colour with three toggles, each named over it.
 *
 * The weight toggle shows each weight as a bar rather than its word; the
 * word stays for screen readers. Each card is a group named by its line.
 */
export function createLineStylesPanel(options: LineStylesPanelOptions): HTMLElement {
  const { styles, onChange } = options;

  const panel = document.createElement('section');
  panel.className = 'block is-outlined line-styles';

  const title = document.createElement('h2');
  title.className = 'heading-h2 block-title';
  title.textContent = '4. Line Styles';

  const columns = document.createElement('div');
  columns.className = 'line-columns';

  for (const { type, name } of STYLED_LINES) {
    const choice = styles[type];
    const nameId = `line-styles-${type}`;

    const column = document.createElement('div');
    column.className = 'line-column frame';
    column.setAttribute('role', 'group');
    column.setAttribute('aria-labelledby', nameId);

    // The line's name, set into the card's top edge.
    const heading = document.createElement('span');
    heading.className = 'heading-h3 frame-title line-column-name';
    heading.id = nameId;
    heading.textContent = name;

    const weight = createChoiceToggle(
      'Weight',
      WEIGHTS,
      `${choice.weight}`,
      (value) => {
        choice.weight = Number(value) as LineWeight;
        onChange();
      },
    );
    weight.classList.add('weight-toggle');

    const dash = createChoiceToggle(
      'Style',
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

    const color = createChoiceToggle(
      'Color',
      LINE_COLORS.map(({ value, name }) => ({ value, label: name })),
      choice.color,
      (value) => {
        choice.color = value;
        onChange();
      },
    );
    color.classList.add('color-toggle');

    const controls = document.createElement('div');
    controls.className = 'line-column-controls';
    controls.append(weight, dash, color);

    column.append(heading, controls);
    columns.append(column);
  }

  panel.append(title, columns);
  return panel;
}
