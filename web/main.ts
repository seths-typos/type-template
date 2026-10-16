import { mountGridOverlay } from './grid-overlay.js';
import { createHeaderPanel, emptyHeaderText } from './header-panel.js';
import { mastersAgree, type FontMaster } from './import/font-source.js';
import { applyFontMetrics, readUpload } from './import/read-upload.js';
import { createPageSetupPanel } from './page-setup.js';
import { createLineStylesPanel, defaultLineStyles } from './line-styles.js';
import { printSheet, saveSheetPdf } from './output.js';
import { createPreviewDialog } from './preview-dialog.js';
import { copyRowState, createRowEditor, newRowState, type RowEditor } from './row-editor.js';
import { ConfigError } from '../src/index.js';
import type { LabelText } from '../src/render/ops.js';
import { rowInput, rowValues } from './row-input.js';
import { MAX_ROWS, createChoiceToggle, createRowCountSlider } from './sheet-controls.js';
import {
  SHEET_FILE_NAME,
  writeSheetFile,
  type RowMetrics,
  type SheetState,
} from './sheet-file.js';
import { defaultPageSetup, previewSheet, type PreviewSheet } from './sheet-preview.js';
import { createUploadDialog } from './upload-dialog.js';
import { downloadText, type UploadFile } from './upload.js';

/**
 * The sheet as the page holds it. All six rows stay on screen; those past
 * the row count are dimmed and disabled, and keep their state for when the
 * count comes back up. With "same", every row draws row 1's state.
 *
 * Loading a config replaces it, and the page is built again from it.
 */
let sheet: SheetState = {
  // The page starts small; the engine's own default (5) is for sheets made
  // without it.
  rowCount: 3,
  metrics: 'same',
  rows: Array.from({ length: MAX_ROWS }, newRowState),
  /** How each line is drawn, the same in every row. */
  lines: defaultLineStyles(),
  /** Optional text across the top of the page. */
  header: emptyHeaderText(),
  /** The paper: its size and orientation. */
  page: defaultPageSetup(),
};

let editors: RowEditor[] = [];

/** Which state each row draws, and whether its metrics can be edited. */
function applyMetrics(): void {
  const same = sheet.metrics === 'same';
  editors.forEach((editor, i) => {
    editor.setState(same ? sheet.rows[0]! : sheet.rows[i]!);
    editor.setMetricsEditable(!same || i === 0);
  });
}

/** With `animate`, rows switching on or off power up or down like screens. */
function applyRowCount(animate = false): void {
  editors.forEach((editor, i) => editor.setActive(i < sheet.rowCount, animate));
}

const preview = createPreviewDialog();

/**
 * The sheet as it will print, or, when a row has a value to fix, the
 * preview opened to say which.
 */
function printable(): PreviewSheet | null {
  const inputs = [];
  const values: LabelText[] = [];
  for (let i = 0; i < sheet.rowCount; i++) {
    const state = sheet.metrics === 'same' ? sheet.rows[0]! : sheet.rows[i]!;
    values.push(rowValues(state));
    const input = rowInput(state, sheet.lines);
    if (!input) {
      // With shared metrics, row 1's values are the ones to fix.
      const row = sheet.metrics === 'same' ? 1 : i + 1;
      preview.open({ message: `Row ${row} has a value to fix before the sheet can be printed.` });
      return null;
    }
    inputs.push(input);
  }
  try {
    return previewSheet(inputs, sheet.header, sheet.page, values);
  } catch (error) {
    // The one page-wide value that can leave no room: the margin.
    if (!(error instanceof ConfigError)) throw error;
    preview.open({ message: 'The margin leaves no room for the rows. Try a smaller one.' });
    return null;
  }
}

/** Run `action` on the sheet, if it can be made. */
const withSheet = (action: (content: PreviewSheet) => unknown) => () => {
  const content = printable();
  if (content) void action(content);
};

function actionButton(label: string, run?: () => void, variant?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = variant ? `action-button ${variant}` : 'action-button';
  button.textContent = label;
  // Read by the stylesheet to hold the width of the label at its hover
  // weight.
  button.dataset.label = label;
  if (run) button.addEventListener('click', run);
  return button;
}

/**
 * An uploaded file, whatever it is. A config replaces the sheet. A font's
 * metrics go into row 1 — and so every row, when they share it — after
 * asking which master, if its masters differ. Done, the dialog closes; going
 * back from the masters leaves it open on the drop area.
 */
async function load(file: UploadFile): Promise<void> {
  const upload = readUpload(file.name, file.bytes);
  if (upload.kind === 'sheet') {
    sheet = upload.sheet;
    render();
    uploadDialog.close();
    return;
  }
  const { masters } = upload.source;
  const master: FontMaster | null = mastersAgree(masters)
    ? masters[0]!
    : await uploadDialog.chooseMaster(file.name, masters);
  if (!master) return;
  applyFontMetrics(sheet.rows[0]!, master.metrics);
  applyMetrics();
  uploadDialog.close();
}

const uploadDialog = createUploadDialog(load);

const saveConfig = () => downloadText(SHEET_FILE_NAME, writeSheetFile(sheet), 'application/json');

let panel: HTMLElement | null = null;

/** Build the page from the sheet, replacing what was there. */
function render(): void {
  editors = sheet.rows.map((state, i) =>
    createRowEditor({
      row: i + 1,
      state,
      styles: sheet.lines,
      onChange: () => {
        // Row 1 leads when metrics are shared: the others show its values.
        if (sheet.metrics === 'same' && i === 0) {
          for (const editor of editors.slice(1)) editor.sync();
        }
      },
    }),
  );

  // The red field: a header — its title, then the sheet's controls — and a
  // row editor per row.
  const next = document.createElement('div');
  next.className = 'rows';

  const title = document.createElement('h2');
  title.className = 'heading-h2 sheet-title block-title';
  title.textContent = '1. Metrics';

  const sheetControls = document.createElement('div');
  sheetControls.className = 'sheet-controls';
  sheetControls.append(
    createRowCountSlider(sheet.rowCount, (count) => {
      sheet.rowCount = count;
      applyRowCount(true);
    }),
    createChoiceToggle<RowMetrics>(
      'Values across rows',
      [
        { value: 'same', label: 'Same' },
        { value: 'different', label: 'Different' },
      ],
      sheet.metrics,
      (metrics) => {
        // Going individual, every row starts from the metrics they shared.
        if (metrics === 'different') {
          const shared = sheet.rows[0]!;
          sheet.rows = sheet.rows.map((row, i) => (i === 0 ? row : copyRowState(shared)));
        }
        sheet.metrics = metrics;
        applyMetrics();
      },
    ),
  );

  const header = document.createElement('div');
  header.className = 'sheet-header';
  header.append(title, sheetControls);

  // The sheet's actions. Bringing a config or a font in sits at the top;
  // what goes out sits in the Output block: Preview, Print, Save to PDF and
  // Save Config. Print goes through the browser's print dialog, the sheet
  // at its true size.
  const inbound = document.createElement('div');
  inbound.className = 'sheet-actions is-inbound';
  // What it takes, beside it, so the button needn't be opened to find out.
  const inboundNote = document.createElement('p');
  inboundNote.className = 'body-sm sheet-actions-note';
  inboundNote.id = 'upload-note';
  inboundNote.textContent =
    'Drop in a .glyphs, .ufo or Sheet-o-matic config to set up your sheet automatically.';
  const uploadButton = actionButton('Upload Config', () => uploadDialog.open());
  uploadButton.setAttribute('aria-describedby', inboundNote.id);
  inbound.append(inboundNote, uploadButton);

  const outputTitle = document.createElement('h2');
  outputTitle.id = 'output-title';
  outputTitle.textContent = '5. Output';
  outputTitle.className = 'heading-h2 block-title output-title';
  // A rule between each action and the next.
  const outputRule = () => {
    const rule = document.createElement('hr');
    rule.className = 'output-rule';
    return rule;
  };
  // Each action centred in an equal share of its part of the column.
  const outputCell = (button: HTMLButtonElement) => {
    const cell = document.createElement('div');
    cell.className = 'output-cell';
    cell.append(button);
    return cell;
  };
  // The column in three equal parts, rules between.
  const outputActions = document.createElement('div');
  outputActions.className = 'output-actions is-column';
  outputActions.append(
    outputCell(actionButton('Preview', withSheet((content) => preview.open(content)), 'is-primary')),
    outputRule(),
    outputCell(actionButton('Print', withSheet(printSheet), 'is-primary')),
    outputRule(),
    outputCell(actionButton('Save to PDF', withSheet(saveSheetPdf), 'is-primary')),
    outputRule(),
    outputCell(actionButton('Save Config', saveConfig, 'is-primary')),
  );
  const outbound = document.createElement('section');
  outbound.className = 'output-block';
  outbound.setAttribute('aria-labelledby', 'output-title');
  // The title and the actions, across the columns the credit leaves them.
  const outputMain = document.createElement('div');
  outputMain.className = 'output-main';
  outputMain.append(outputTitle, outputActions);
  outbound.append(outputMain);

  // Above everything: the app's name centred, Upload Config on the right.
  const appTitle = document.createElement('h1');
  appTitle.className = 'heading-h1 app-title';
  appTitle.textContent = 'Sheet-o-matic';
  const topBar = document.createElement('header');
  topBar.className = 'app-header';
  topBar.append(appTitle, inbound);

  const rowEditors = document.createElement('div');
  rowEditors.className = 'row-editors';
  rowEditors.append(...editors.map((editor) => editor.element));

  // Line styles sit under the rows, and every row redraws with them.
  const lineStyles = createLineStylesPanel({
    styles: sheet.lines,
    onChange: () => {
      for (const editor of editors) editor.sync();
    },
  });

  // Who made it, at the end of Output, past a rule.
  const credit = document.createElement('a');
  credit.className = 'body-sm credit-link';
  credit.href = 'https://www.instagram.com/seths_typos/';
  credit.target = '_blank';
  credit.rel = 'noopener';
  credit.textContent = "One of Seth's Typos";
  outbound.append(credit);

  // The title, the sheet's controls and the rows, on their own field.
  const metricsBlock = document.createElement('div');
  metricsBlock.className = 'block metrics-block';
  metricsBlock.append(header, rowEditors);

  // Under the rows: Page Setup over Header, sharing the row's height, then
  // Line Styles with Output in the box beneath it.
  const side = document.createElement('div');
  side.className = 'footer-side';
  side.append(createPageSetupPanel(sheet.page), createHeaderPanel(sheet.header));
  const footer = document.createElement('div');
  footer.className = 'sheet-footer';
  footer.append(side, lineStyles, outbound);

  next.append(topBar, metricsBlock, footer);

  if (panel) panel.replaceWith(next);
  else document.querySelector('#app')!.prepend(next);
  panel = next;

  applyMetrics();
  applyRowCount();
}

document.querySelector('#app')!.append(preview.element, uploadDialog.element);
render();

// Shift+G shows the page grid, read live from the grid tokens. Development
// only; it isn't in a build.
if (import.meta.env.DEV) mountGridOverlay();
