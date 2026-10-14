import { DEFAULTS, buildSheet, resolveConfig } from '../src/index.js';
import type { LineType, Sheet, SheetConfig, SheetInput } from '../src/index.js';
import type { DrawOptions, LabelText } from '../src/render/ops.js';
import { emptyHeaderText, type HeaderText } from './header-panel.js';
import type { Orientation, PagePreset } from '../src/index.js';

/** The paper the sheet is set on. */
export interface PageSetup {
  size: PagePreset;
  orientation: Orientation;
  /** pt, the same on all four sides. */
  margin: number;
  /** Each metric line's value, in font units, set in the left margin. */
  values: boolean;
}

export function defaultPageSetup(): PageSetup {
  return { size: 'letter', orientation: 'landscape', margin: DEFAULTS.page.margins.top, values: true };
}

export interface PreviewSheet {
  sheet: Sheet;
  config: SheetConfig;
  /** How its text is set, for every renderer. */
  options: DrawOptions;
  /** For renderers that name a font: the PDF sets Helvetica, Arial's twin. */
  fontFamily: string;
  /** The page setup it was made on, as the user chose it. */
  page: PageSetup;
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
 * The printed sheet: on `page`, `inputs.length` rows filling it, each
 * row drawn from its own input. With `page.values` on, each row's lines are
 * labelled in the left margin with `values` — its own, as rows can differ;
 * otherwise they go unlabelled.
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
  page: PageSetup = defaultPageSetup(),
  values: LabelText[] = [],
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
      page: {
        ...input.page,
        size: page.size,
        orientation: page.orientation,
        margins: { top: page.margin, right: page.margin, bottom: page.margin, left: page.margin },
      },
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
    labels: { ...first.labels, enabled: page.values },
  };

  return {
    sheet: { ...buildSheet(first), rows: built.map((b) => b.row) },
    config,
    options: { header: HEADER_TEXT, labelText: values },
    fontFamily: HEADER_FONT,
    page: { ...page },
  };
}
