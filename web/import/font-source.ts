/**
 * What a font file says about its vertical metrics, read for the row
 * editors. Values are font units, as the editors take them, and the italic
 * angle is in the app's convention — degrees from vertical, positive leaning
 * right — whatever the file's own.
 */
export interface FontMetrics {
  ascender?: number;
  capHeight?: number;
  xHeight?: number;
  descender?: number;
  italicAngle?: number;
}

/** One master of a source. */
export interface FontMaster {
  name: string;
  metrics: FontMetrics;
}

export interface FontSource {
  /** The file's kind, as the user would name it: "Glyphs" or "UFO". */
  format: string;
  masters: FontMaster[];
}

/** A file that was recognised but can't be read, with why, for the user. */
export class FontImportError extends Error {
  override name = 'FontImportError';
}

const METRIC_KEYS: (keyof FontMetrics)[] = [
  'ascender',
  'capHeight',
  'xHeight',
  'descender',
  'italicAngle',
];

/** Whether every master has the same metrics, so there is nothing to choose. */
export function mastersAgree(masters: FontMaster[]): boolean {
  const [first, ...rest] = masters;
  return rest.every((master) =>
    METRIC_KEYS.every((key) => master.metrics[key] === first!.metrics[key]),
  );
}
