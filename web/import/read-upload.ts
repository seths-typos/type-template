import type { FontUnitMetrics, MetricLine } from '../../src/index.js';
import { metricOrderErrors } from '../metric-order.js';
import type { RowState } from '../row-input.js';
import { isSheetFile, readSheetFile, type SheetState } from '../sheet-file.js';
import { FontImportError, type FontMetrics, type FontSource } from './font-source.js';
import { readGlyphs } from './glyphs.js';
import { readUfoFontInfo } from './ufo.js';

export type Upload = { kind: 'sheet'; sheet: SheetState } | { kind: 'font'; source: FontSource };

/**
 * Whatever was uploaded, worked out from its contents — the name is only a
 * tiebreak — so a renamed file still loads:
 *
 * - a Sheet-o-matic config, JSON naming the app;
 * - a UFO's `fontinfo.plist`, an XML property list;
 * - a Glyphs file, or the `fontinfo.plist` of a `.glyphspackage`, an
 *   old-style property list.
 *
 * A UFO or a .glyphspackage is a folder; whoever reads it hands over its
 * `fontinfo.plist`.
 */
export function readUpload(name: string, bytes: ArrayBuffer): Upload {
  if (isCompiledFont(bytes)) {
    throw new FontImportError(
      'Compiled fonts (.otf, .ttf) aren’t supported: the metrics they store don’t always match the design. Upload the Glyphs file or UFO it was made from.',
    );
  }

  const text = new TextDecoder().decode(bytes).replace(/^﻿/, '');
  const start = text.trimStart();

  if (start.startsWith('{') || start.startsWith('[')) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (json !== undefined) {
      if (isSheetFile(json)) return { kind: 'sheet', sheet: readSheetFile(json) };
      if (/\.json$/i.test(name)) throw new FontImportError('This isn’t a Sheet-o-matic config file.');
    }
  }

  if (start.startsWith('<?xml') || /^<(!DOCTYPE\s+)?plist/.test(start)) {
    return font(readUfoFontInfo(text));
  }
  if (start.startsWith('{')) return font(readGlyphs(text));

  throw new FontImportError(
    'This file isn’t one Sheet-o-matic can read. Upload a config (.json), a Glyphs 3 file (.glyphs, .glyphspackage) or a UFO (.ufo).',
  );
}

/** OpenType, TrueType, a collection or a web font, by its first four bytes. */
const COMPILED = new Set(['\0\x01\0\0', 'OTTO', 'true', 'ttcf', 'wOFF', 'wOF2']);

function isCompiledFont(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  return COMPILED.has(String.fromCharCode(...new Uint8Array(bytes, 0, 4)));
}

/** A font with every master able to set a row: each needs its cap height. */
function font(source: FontSource): Upload {
  if (source.masters.some((master) => !(master.metrics.capHeight! > 0))) {
    throw new FontImportError(
      'This font has no cap height, which the rows are measured from. Set one and upload it again.',
    );
  }
  return { kind: 'font', source };
}

/**
 * A master's metrics onto a row. Each line the font has takes its value and
 * is switched on; one it doesn't have is switched off, its old value kept for
 * if it's switched back on. So is one out of the editor's order — an
 * ascender on the cap height, say, which the cap height line already marks —
 * its value still showing. The cap height and baseline are always drawn. A
 * font with no italic angle, or an upright one, switches the slant lines off.
 */
export function applyFontMetrics(state: RowState, metrics: FontMetrics): void {
  state.units.capHeight = metrics.capHeight!;
  state.visible.capHeight = true;
  state.visible.baseline = true;
  for (const key of ['ascender', 'xHeight', 'descender'] as const) {
    const value = metrics[key];
    // 0 is how Glyphs writes a metric it has no value for.
    state.visible[key] = value !== undefined && value !== 0;
    if (state.visible[key]) state.units[key] = value!;
  }
  const units = state.units as FontUnitMetrics;
  for (const path of metricOrderErrors(units, state.visible).keys()) {
    state.visible[path.replace('metrics.', '') as MetricLine] = false;
  }

  const angle = metrics.italicAngle;
  state.slant.enabled = !!angle;
  if (angle) state.slant.angle = angle;
}
