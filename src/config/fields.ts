import { DEFAULTS } from './defaults.js';
import { METRIC_MODES, ORIENTATIONS, VERTICAL_ALIGNMENTS } from './options.js';
import { PAGE_PRESET_NAMES } from './presets.js';
import type { LineStyle } from './types.js';

/**
 * A description of every field the input accepts.
 *
 * This is what `npm run fields` prints, and it is how the config surface gets
 * reviewed without a front end. Defaults are read from DEFAULTS rather than
 * retyped, and a test asserts this table covers exactly the input surface —
 * so a field cannot be added without being described.
 */
export interface FieldSpec {
  path: string;
  type: string;
  unit?: string;
  /** Printable default, or undefined when the field has none. */
  default?: string;
  /** Allowed values, for `enum` and `preset` fields. Drives the form's select. */
  options?: readonly string[];
  notes?: string;
}

/** Fields with no default — required when their feature is on. */
export const DEFAULTLESS = ['slant.angle'] as const;

const show = (value: unknown): string =>
  typeof value === 'string' ? `'${value}'` : JSON.stringify(value);

function lineStyle(prefix: string, style: LineStyle, what: string): FieldSpec[] {
  return [
    { path: `${prefix}.visible`, type: 'boolean', default: show(style.visible), notes: `draw the ${what}` },
    { path: `${prefix}.weight`, type: 'number', unit: 'pt', default: show(style.weight), notes: '> 0' },
    { path: `${prefix}.color`, type: 'string', unit: 'hex', default: show(style.color), notes: '#rgb or #rrggbb' },
    {
      path: `${prefix}.dash`,
      type: 'number[] | null',
      unit: 'pt',
      default: show(style.dash),
      notes: 'null is solid; lengths alternate on, off',
    },
  ];
}

const { page, header, metrics, lines, labels, slant } = DEFAULTS;

export const FIELDS: FieldSpec[] = [
  { path: 'page.size', type: 'preset', default: show(page.size), options: PAGE_PRESET_NAMES },
  { path: 'page.orientation', type: 'enum', default: show(page.orientation), options: ORIENTATIONS },
  { path: 'page.margins.top', type: 'number', unit: 'pt', default: show(page.margins.top), notes: '>= 0' },
  { path: 'page.margins.right', type: 'number', unit: 'pt', default: show(page.margins.right), notes: '>= 0' },
  { path: 'page.margins.bottom', type: 'number', unit: 'pt', default: show(page.margins.bottom), notes: '>= 0' },
  { path: 'page.margins.left', type: 'number', unit: 'pt', default: show(page.margins.left), notes: '>= 0' },

  { path: 'header.enabled', type: 'boolean', default: show(header.enabled), notes: 'reserve a block at the top' },
  { path: 'header.height', type: 'number', unit: 'pt', default: show(header.height), notes: '>= 0; taken below the top margin' },
  { path: 'header.text', type: 'string', default: show(header.text), notes: 'free text; \\n starts a new line' },

  { path: 'metrics.mode', type: 'enum', default: show(metrics.mode), options: METRIC_MODES, notes: 'which of the two is the input; the other is computed' },
  { path: 'metrics.capHeight', type: 'number', unit: 'pt', default: show(metrics.capHeight), notes: '> 0; the reference metric. Computed in rowCount mode' },
  { path: 'metrics.rowCount', type: 'integer', default: show(metrics.rowCount), notes: '>= 1; computed in capHeight mode' },
  { path: 'metrics.xHeight', type: 'number', unit: '% of cap height', default: show(metrics.xHeight), notes: '> 0' },
  { path: 'metrics.ascender', type: 'number', unit: '% of cap height', default: show(metrics.ascender), notes: '>= 0; sets the top of the row band when above the cap height' },
  { path: 'metrics.descender', type: 'number', unit: '% of cap height', default: show(metrics.descender), notes: '<= 0; sets the bottom of the row band, or the baseline does at 0' },
  { path: 'metrics.rowGap', type: 'number', unit: 'pt', default: show(metrics.rowGap), notes: '>= 0; bottom of one row band to the top of the next' },
  { path: 'metrics.verticalAlign', type: 'enum', default: show(metrics.verticalAlign), options: VERTICAL_ALIGNMENTS },

  ...lineStyle('lines.baseline', lines.baseline, 'baseline'),
  ...lineStyle('lines.capHeight', lines.capHeight, 'cap height line'),
  ...lineStyle('lines.xHeight', lines.xHeight, 'x-height line'),
  ...lineStyle('lines.ascender', lines.ascender, 'ascender line'),
  ...lineStyle('lines.descender', lines.descender, 'descender line'),

  { path: 'labels.enabled', type: 'boolean', default: show(labels.enabled), notes: 'B, C and X in the left margin naming their lines' },
  { path: 'labels.size', type: 'number', unit: 'pt', default: show(labels.size), notes: '> 0' },
  { path: 'labels.color', type: 'string', unit: 'hex', default: show(labels.color), notes: '#rgb or #rrggbb' },
  { path: 'labels.gap', type: 'number', unit: 'pt', default: show(labels.gap), notes: '>= 0; label to the left end of its line' },

  { path: 'slant.enabled', type: 'boolean', default: show(slant.enabled), notes: 'diagonal guides for italic work' },
  { path: 'slant.angle', type: 'number', unit: 'degrees', notes: 'REQUIRED when enabled, no default; from vertical, -90 to 90, positive leans right' },
  { path: 'slant.spacing', type: 'number', unit: 'pt', default: show(slant.spacing), notes: '> 0; measured along the baseline' },
  { path: 'slant.inset', type: 'number', unit: 'pt', default: show(slant.inset), notes: 'first line, from the left edge of the row' },
  ...lineStyle('slant.style', slant.style, 'slant lines'),
];
