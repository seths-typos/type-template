/**
 * Prints the config input surface: every field, its type, unit, default and
 * constraints. Run with `npm run fields`.
 *
 * This is how the config surface gets reviewed without a front end.
 */
import { FIELDS, type FieldSpec } from '../src/config/index.js';

const columns = [
  (f: FieldSpec) => f.path.slice(f.path.indexOf('.') + 1),
  (f: FieldSpec) => f.type,
  (f: FieldSpec) => f.unit ?? '',
  (f: FieldSpec) => f.default ?? '—',
] as const;

// Every column is as wide as its widest cell, so rows always line up.
const widths = columns.map((get) => Math.max(...FIELDS.map((f) => get(f).length)));

const sections = new Map<string, FieldSpec[]>();

for (const field of FIELDS) {
  const section = field.path.slice(0, field.path.indexOf('.'));
  sections.set(section, [...(sections.get(section) ?? []), field]);
}

console.log(`\nConfig input surface — ${FIELDS.length} fields. Anything omitted keeps its default.\n`);

for (const [section, fields] of sections) {
  console.log(section);

  for (const field of fields) {
    const cells = columns.map((get, i) => get(field).padEnd(widths[i]!));

    const options = field.options ? field.options.join(' | ') : '';
    const notes = [options, field.notes].filter(Boolean).join('; ');

    console.log(`  ${cells.join('  ')}  ${notes}`.trimEnd());
  }

  console.log('');
}
