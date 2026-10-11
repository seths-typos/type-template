import { createLineStylesPanel, defaultLineStyles } from './line-styles.js';
import { copyRowState, createRowEditor, newRowState } from './row-editor.js';
import { MAX_ROWS, createChoiceToggle, createRowCountSlider } from './sheet-controls.js';

type RowMetrics = 'same' | 'different';

/**
 * The sheet as the page holds it. All six rows stay on screen; those past
 * the row count are dimmed and disabled, and keep their state for when the
 * count comes back up. With "same", every row draws row 1's state.
 */
const sheet = {
  // The page starts small; the engine's own default (5) is for sheets made
  // without it.
  rowCount: 3,
  metrics: 'same' as RowMetrics,
  rows: Array.from({ length: MAX_ROWS }, newRowState),
  /** How each line is drawn, the same in every row. */
  lines: defaultLineStyles(),
};

const editors = sheet.rows.map((state, i) =>
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

// The red field: a header — its title, then the sheet's controls — and a
// row editor per row.
const panel = document.createElement('div');
panel.className = 'rows';

const title = document.createElement('h2');
title.className = 'heading-h2 sheet-title';
title.textContent = 'Row Metrics';

const sheetControls = document.createElement('div');
sheetControls.className = 'sheet-controls';
sheetControls.append(
  createRowCountSlider(sheet.rowCount, (count) => {
    sheet.rowCount = count;
    applyRowCount(true);
  }),
  createChoiceToggle<RowMetrics>(
    'Row metrics',
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

// What to do with the finished sheet. Not wired up yet: printing and the
// PDF wait on the engine taking per-row metrics, and the config on its file
// format.
const actions = document.createElement('div');
actions.className = 'sheet-actions';
for (const label of ['Preview', 'Print', 'Save to PDF', 'Download Config']) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'action-button';
  button.textContent = label;
  // Read by the stylesheet to hold the width of the label at its hover
  // weight.
  button.dataset.label = label;
  actions.append(button);
}

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

// Under the rows: Line Styles, then the actions centred in the space left
// beside it.
const footer = document.createElement('div');
footer.className = 'sheet-footer';
footer.append(lineStyles, actions);

panel.append(header, rowEditors, footer);

// Line Styles spans four row editors. A row editor's width comes from its
// contents, so it's measured, and again whenever it changes.
new ResizeObserver(([entry]) => {
  panel.style.setProperty('--editor-width', `${entry!.borderBoxSize[0]!.inlineSize}px`);
}).observe(editors[0]!.element);
document.querySelector('#app')!.append(panel);

applyMetrics();
applyRowCount();
