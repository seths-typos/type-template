import { FontImportError, type FontMaster, type FontMetrics, type FontSource } from './font-source.js';
import { parseOpenStep, type PlistValue } from './openstep.js';

type Dict = { [key: string]: PlistValue };

/** Glyphs' metric types, as the app names them. Others are left out. */
const TYPES: Record<string, keyof FontMetrics> = {
  ascender: 'ascender',
  'cap height': 'capHeight',
  'x-height': 'xHeight',
  descender: 'descender',
  'italic angle': 'italicAngle',
};

/**
 * A Glyphs 3 (or later) source: a `.glyphs` file, or the `fontinfo.plist`
 * inside a `.glyphspackage`, which holds the same font-level keys.
 *
 * The font lists its metrics once, in `metrics`; each master's
 * `metricValues` gives their values in the same order. A value with no `pos`
 * is 0. Metrics limited to some glyphs by a `filter` aren't the font's own
 * lines, so they're passed over. Glyphs counts the italic angle as the app
 * does, so it comes through as is.
 */
export function readGlyphs(text: string): FontSource {
  let root: PlistValue;
  try {
    root = parseOpenStep(text);
  } catch {
    throw new FontImportError("This Glyphs file couldn't be read.");
  }
  if (!isDict(root)) throw new FontImportError("This Glyphs file couldn't be read.");

  const version = root['.formatVersion'];
  if (typeof version !== 'number' || version < 3) {
    throw new FontImportError(
      'This is a Glyphs 2 file. Open it in Glyphs 3 and save it, then upload it again.',
    );
  }

  const metrics = list(root.metrics);
  const masters = list(root.fontMaster).filter(isDict);
  if (masters.length === 0) throw new FontImportError('This Glyphs file has no masters.');

  return {
    format: 'Glyphs',
    masters: masters.map((master, m): FontMaster => {
      const values = list(master.metricValues);
      const out: FontMetrics = {};
      metrics.forEach((metric, i) => {
        if (!isDict(metric) || metric.filter !== undefined) return;
        const key = TYPES[String(metric.type)];
        const value = values[i];
        if (!key || !isDict(value) || out[key] !== undefined) return;
        out[key] = typeof value.pos === 'number' ? value.pos : 0;
      });
      const name = master.name ?? master.iconName;
      return { name: typeof name === 'string' ? name : `Master ${m + 1}`, metrics: out };
    }),
  };
}

function isDict(value: PlistValue | undefined): value is Dict {
  return typeof value === 'object' && !Array.isArray(value);
}

function list(value: PlistValue | undefined): PlistValue[] {
  return Array.isArray(value) ? value : [];
}
