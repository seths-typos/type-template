import { buildSheet, resolveConfig } from '../src/index.js';
import type { LineType, Sheet, SheetConfig, SheetInput } from '../src/index.js';
import type { DrawOptions } from '../src/render/ops.js';
import { emptyHeaderText, type HeaderText } from './header-panel.js';

export interface PreviewSheet {
  sheet: Sheet;
  config: SheetConfig;
  /** How its text is set, for every renderer. */
  options: DrawOptions;
  /** For renderers that name a font: the PDF sets Helvetica, Arial's twin. */
  fontFamily: string;
}

/** Header text: 10 pt Arial. */
export const HEADER_TEXT = { size: 10, lineHeight: 12, color: '#000000' };
export const HEADER_FONT = 'Arial, Helvetica, sans-serif';

/**
 * Room reserved for the header below the top margin: its 10 pt line, and
 * a gap before the first row.
 */
export const HEADER_HEIGHT = 24;

/**
 * The printed sheet: landscape, `inputs.length` rows filling the page, each
 * row drawn from its own input, with no metric labels.
 *
 * The engine takes one set of metrics for the whole sheet, so this builds a
 * sheet per row and keeps only that row from each. That works because in
 * row-count mode every row band is the same height, whatever its metrics —
 * the band is set by the row count, the cap height solved to fit it — so a
 * row lands in the same place on every one of those sheets.
 *
 * Line styles are shared by every row; only visibility differs, so each
 * row's hidden lines are dropped here and the combined config draws every
 * line it is given. A dropped line takes its label with it, as the
 * renderer only labels lines that are there.
 */
export function previewSheet(
  inputs: SheetInput[],
  headerText: HeaderText = emptyHeaderText(),
): PreviewSheet {
  const rowCount = inputs.length;
  if (rowCount === 0) throw new Error('A sheet needs at least one row.');

  // Reserved only when there's something to put in it; it takes from the
  // rows' height, the same on every per-row sheet.
  const enabled = Object.values(headerText).some((text) => text.trim() !== '');
  const header = { enabled, height: HEADER_HEIGHT, ...headerText };

  const built = inputs.map((input, index) => {
    const config = resolveConfig({
      ...input,
      page: { ...input.page, orientation: 'landscape' },
      metrics: { ...input.metrics, mode: 'rowCount', rowCount },
      labels: { enabled: false },
      header,
    });
    const row = buildSheet(config).rows[index]!;
    const shown = (type: LineType) =>
      type === 'slant' ? config.slant.style.visible : config.lines[type].visible;

    return { config, row: { ...row, lines: row.lines.filter((line) => shown(line.type)) } };
  });

  const first = built[0]!.config;
  const config: SheetConfig = {
    ...first,
    lines: Object.fromEntries(
      Object.entries(first.lines).map(([type, style]) => [type, { ...style, visible: true }]),
    ) as SheetConfig['lines'],
    slant: { ...first.slant, style: { ...first.slant.style, visible: true } },
  };

  return {
    sheet: { ...buildSheet(first), rows: built.map((b) => b.row) },
    config,
    options: { header: HEADER_TEXT },
    fontFamily: HEADER_FONT,
  };
}
