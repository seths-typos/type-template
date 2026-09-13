/**
 * Writes sample sheets to proofs/ for checking against a printed page.
 *
 * Uses the fixture config until config/ exists — it holds the documented
 * defaults. Run with `npm run proof`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSheetPdf } from '../src/index.js';
import { buildSheet } from '../src/geometry/index.js';
import { baseConfig } from '../src/testing/fixtures.js';
import type { SheetConfig } from '../src/config/types.js';

const PROOFS = new URL('../proofs/', import.meta.url);

const variants: Record<string, (config: SheetConfig) => void> = {
  defaults: () => {},

  'header-and-slant': (config) => {
    config.header.enabled = true;
    config.header.text = 'Type Cooker brief\nweight: bold   contrast: low   width: condensed';
    config.slant.enabled = true;
    config.slant.angle = 12;
  },

  'portrait-rowcount': (config) => {
    config.page = { width: 612, height: 792, margins: config.page.margins };
    config.metrics.mode = 'rowCount';
    config.metrics.rowCount = 6;
    config.metrics.verticalAlign = 'justify';
  },

  'dashed-guides': (config) => {
    config.lines.xHeight.dash = [3, 2];
    config.lines.ascender.dash = [1, 3];
    config.lines.descender.dash = [1, 3];
    config.lines.capHeight.visible = false;
  },
};

mkdirSync(PROOFS, { recursive: true });

for (const [name, apply] of Object.entries(variants)) {
  const config = baseConfig();
  apply(config);

  const sheet = buildSheet(config);
  const bytes = await createSheetPdf(config);
  const path = new URL(`${name}.pdf`, PROOFS);

  writeFileSync(path, bytes);

  console.log(
    `${name.padEnd(20)} ${sheet.page.width} x ${sheet.page.height} pt, ` +
      `${sheet.rows.length} rows, cap height ${sheet.capHeight.toFixed(2)} pt`,
  );
}

console.log(`\nWritten to ${PROOFS.pathname}`);
