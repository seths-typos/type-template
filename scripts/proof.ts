/**
 * Writes sample sheets to proofs/ for checking against a printed page.
 *
 * Variants are raw input, so this exercises the same front door a caller
 * uses. Run with `npm run proof`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolveConfig } from '../src/config/index.js';
import { buildSheet } from '../src/geometry/index.js';
import { createSheetPdf } from '../src/index.js';
import type { SheetInput } from '../src/config/types.js';

const PROOFS = new URL('../proofs/', import.meta.url);

const variants: Record<string, SheetInput> = {
  defaults: {},

  'header-and-slant': {
    header: {
      enabled: true,
      left: 'Type Cooker brief\nweight: bold   contrast: low   width: condensed',
      right: 'date',
    },
    slant: { enabled: true, angle: 12 },
  },

  'portrait-rowcount': {
    page: { orientation: 'portrait' },
    metrics: { mode: 'rowCount', rowCount: 6, verticalAlign: 'justify' },
  },

  'dashed-guides': {
    lines: {
      capHeight: { visible: false },
      xHeight: { dash: [3, 2] },
      ascender: { dash: [1, 3] },
      descender: { dash: [1, 3] },
    },
  },
};

mkdirSync(PROOFS, { recursive: true });

for (const [name, input] of Object.entries(variants)) {
  const sheet = buildSheet(resolveConfig(input));
  const bytes = await createSheetPdf(input);

  writeFileSync(new URL(`${name}.pdf`, PROOFS), bytes);

  console.log(
    `${name.padEnd(20)} ${sheet.page.width} x ${sheet.page.height} pt, ` +
      `${sheet.rows.length} rows, cap height ${sheet.capHeight.toFixed(2)} pt`,
  );
}

console.log(`\nWritten to ${PROOFS.pathname}`);
