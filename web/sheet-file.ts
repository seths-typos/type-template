import type { HeaderText } from './header-panel.js';
import { LINE_COLORS, STYLED_LINES, type LineStyles } from './line-styles.js';
import type { RowState } from './row-input.js';
import { MAX_ROWS, MIN_ROWS } from './sheet-controls.js';
import type { PageSetup } from './sheet-preview.js';

export type RowMetrics = 'same' | 'different';

/** The sheet as the page holds it; what a config file saves and restores. */
export interface SheetState {
  rowCount: number;
  metrics: RowMetrics;
  /** Every row, those past the row count too, so they come back as they were. */
  rows: RowState[];
  lines: LineStyles;
  header: HeaderText;
  page: PageSetup;
}

/** Names the file as this app's, so an upload can tell it from other JSON. */
const APP = 'sheet-o-matic';
const VERSION = 1;

export const SHEET_FILE_NAME = 'practice-sheet-config.json';

/** The sheet as a config file's text. */
export function writeSheetFile(sheet: SheetState): string {
  const { rowCount, metrics, rows, lines, header, page } = sheet;
  return `${JSON.stringify({ app: APP, version: VERSION, rowCount, metrics, rows, lines, header, page }, null, 2)}\n`;
}

/** Whether this parsed JSON says it is one of this app's config files. */
export function isSheetFile(json: unknown): boolean {
  return isObject(json) && json.app === APP;
}

/** A config file that isn't one, or has a value that can't be used. */
export class SheetFileError extends Error {
  override name = 'SheetFileError';
}

/**
 * A config file back into the sheet. Every value is checked; one that can't
 * be used rejects the file, naming the first, rather than half-loading it.
 */
export function readSheetFile(json: unknown): SheetState {
  if (!isSheetFile(json)) throw new SheetFileError('This isn’t a Sheet-o-matic config file.');
  const file = json as Record<string, unknown>;
  if (typeof file.version !== 'number' || file.version > VERSION) {
    throw new SheetFileError('This config was saved by a newer version of Sheet-o-matic.');
  }

  const bad = (path: string): never => {
    throw new SheetFileError(`This config file has a value that can’t be used: ${path}.`);
  };

  const { rowCount, metrics, rows, lines, header, page } = file;
  if (!Number.isInteger(rowCount) || (rowCount as number) < MIN_ROWS || (rowCount as number) > MAX_ROWS) {
    bad('rowCount');
  }
  if (metrics !== 'same' && metrics !== 'different') bad('metrics');
  if (!Array.isArray(rows) || rows.length !== MAX_ROWS) bad('rows');

  return {
    rowCount: rowCount as number,
    metrics: metrics as RowMetrics,
    rows: (rows as unknown[]).map((row, i) => readRow(row, `rows[${i}]`, bad)),
    lines: readLines(lines, bad),
    header: readHeader(header, bad),
    page: readPage(page, bad),
  };
}

type Bad = (path: string) => never;

const UNIT_KEYS = ['ascender', 'capHeight', 'xHeight', 'descender'] as const;
const LINE_KEYS = ['ascender', 'capHeight', 'xHeight', 'baseline', 'descender'] as const;

function readRow(row: unknown, path: string, bad: Bad): RowState {
  if (!isObject(row)) bad(path);
  const { units, visible, slant } = row as Record<string, unknown>;
  if (!isObject(units)) bad(`${path}.units`);
  if (!isObject(visible)) bad(`${path}.visible`);
  if (!isObject(slant)) bad(`${path}.slant`);
  const u = units as Record<string, unknown>;
  const v = visible as Record<string, unknown>;
  const s = slant as Record<string, unknown>;

  const out: RowState = {
    units: { ascender: null, capHeight: null, xHeight: null, descender: null },
    visible: { ascender: true, capHeight: true, xHeight: true, baseline: true, descender: true },
    slant: { enabled: false, angle: null },
  };
  // Null is a field whose text wasn't a number when it was saved.
  for (const key of UNIT_KEYS) {
    if (u[key] !== null && !isNumber(u[key])) bad(`${path}.units.${key}`);
    out.units[key] = u[key] as number | null;
  }
  for (const key of LINE_KEYS) {
    if (typeof v[key] !== 'boolean') bad(`${path}.visible.${key}`);
    out.visible[key] = v[key] as boolean;
  }
  if (typeof s.enabled !== 'boolean') bad(`${path}.slant.enabled`);
  if (s.angle !== null && !isNumber(s.angle)) bad(`${path}.slant.angle`);
  out.slant = { enabled: s.enabled as boolean, angle: s.angle as number | null };
  return out;
}

function readLines(lines: unknown, bad: Bad): LineStyles {
  if (!isObject(lines)) bad('lines');
  const l = lines as Record<string, unknown>;
  const colors = LINE_COLORS.map((c) => c.value);
  const out = {} as LineStyles;
  for (const { type } of STYLED_LINES) {
    const choice = l[type];
    if (!isObject(choice)) bad(`lines.${type}`);
    const { weight, dashed, color } = choice as Record<string, unknown>;
    if (weight !== 1 && weight !== 2 && weight !== 3) bad(`lines.${type}.weight`);
    if (typeof dashed !== 'boolean') bad(`lines.${type}.dashed`);
    if (typeof color !== 'string' || !colors.includes(color)) bad(`lines.${type}.color`);
    out[type] = { weight: weight as 1 | 2 | 3, dashed: dashed as boolean, color: color as string };
  }
  return out;
}

function readHeader(header: unknown, bad: Bad): HeaderText {
  if (!isObject(header)) bad('header');
  const h = header as Record<string, unknown>;
  for (const key of ['left', 'center', 'right'] as const) {
    if (typeof h[key] !== 'string') bad(`header.${key}`);
  }
  return { left: h.left as string, center: h.center as string, right: h.right as string };
}

function readPage(page: unknown, bad: Bad): PageSetup {
  if (!isObject(page)) bad('page');
  const { size, orientation, margin } = page as Record<string, unknown>;
  if (size !== 'letter' && size !== 'a4') bad('page.size');
  if (orientation !== 'portrait' && orientation !== 'landscape') bad('page.orientation');
  if (!isNumber(margin) || (margin as number) < 0) bad('page.margin');
  return { size: size as PageSetup['size'], orientation: orientation as PageSetup['orientation'], margin: margin as number };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
