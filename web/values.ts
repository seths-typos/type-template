import type { FieldSpec } from '../src/index.js';

/**
 * What a control starts at and what it reads back, kept free of the DOM so
 * the round trip is testable: every control's initial value must reconstruct
 * the engine's own default.
 */
export type ControlKind = 'boolean' | 'select' | 'number' | 'color' | 'dash' | 'text';

export function controlKind(field: FieldSpec): ControlKind {
  if (field.type === 'boolean') return 'boolean';
  if (field.options) return 'select';
  if (field.type === 'number' || field.type === 'integer') return 'number';
  if (field.unit === 'hex') return 'color';
  if (field.type.startsWith('number[]')) return 'dash';

  return 'text';
}

/** The control's starting value, as a string. `''` when the field has no default. */
export function initialValue(field: FieldSpec): string {
  return field.default === undefined ? '' : field.default.replace(/^'|'$/g, '');
}

export interface Parsed {
  /** False means leave the field out entirely, so the default applies. */
  set: boolean;
  value?: unknown;
}

export function parseValue(kind: ControlKind, raw: string): Parsed {
  if (kind === 'boolean') return { set: true, value: raw === 'true' };

  // Blank means unset everywhere, so clearing any field brings its default
  // back. Text is the exception: empty header text is a real value. Type
  // `null` in a dash field to ask for a solid line.
  if (raw === '' && kind !== 'text' && kind !== 'color') return { set: false };

  if (kind === 'number') return { set: true, value: Number(raw) };
  if (kind === 'dash') return { set: true, value: parseDash(raw) };

  return { set: true, value: raw };
}

/**
 * `null` or a JSON array of lengths. Anything else passes through as the
 * string it was, so config reports it rather than the form swallowing it.
 */
function parseDash(raw: string): unknown {
  const trimmed = raw.trim();

  if (trimmed === '' || trimmed === 'null') return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
