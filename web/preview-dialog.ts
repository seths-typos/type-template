import { drawSheetToCanvas } from '../src/render/canvas/index.js';
import type { PageSetup, PreviewSheet } from './sheet-preview.js';

const PAPER_NAMES: Record<PageSetup['size'], string> = { letter: 'Letter', a4: 'A4' };
const ORIENTATION_NAMES: Record<PageSetup['orientation'], string> = {
  portrait: 'Portrait',
  landscape: 'Landscape',
};

/** What the sheet is set on, for the table beside it. */
function pageRows(page: PageSetup): [string, string][] {
  return [
    ['Orientation', ORIENTATION_NAMES[page.orientation]],
    ['Paper', PAPER_NAMES[page.size]],
    ['Margins', `${page.margin} pt`],
    ['Metric values', page.values ? 'Shown' : 'Hidden'],
  ];
}

export interface PreviewDialog {
  element: HTMLDialogElement;
  /** Slide down showing this sheet, or a message saying why there isn't one. */
  open(content: PreviewSheet | { message: string }): void;
}

/** The paper's outline width in CSS px: --border-thick. */
const OUTLINE = 2;

/**
 * The sheet as it will print, on a panel that slides down from the top of
 * the screen, a Close button at its top right. A modal dialog, so focus stays
 * in it and Escape closes it — sliding back up, as it came.
 */
export function createPreviewDialog(): PreviewDialog {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet-preview';
  dialog.setAttribute('aria-label', 'Sheet preview');
  // Focus lands on the panel itself when it opens, not on Close, which
  // would otherwise show as focused — in its hover colour — straight away.
  dialog.tabIndex = -1;

  // Styled as the page's action buttons.
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'action-button sheet-preview-close';
  close.textContent = 'Close';
  close.dataset.label = 'Close';

  const stage = document.createElement('div');
  stage.className = 'sheet-preview-stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'sheet-preview-paper';

  const message = document.createElement('p');
  message.className = 'body-md sheet-preview-message';

  // Beside the sheet, on its left: the page setup it's on, a row each.
  const details = document.createElement('table');
  details.className = 'sheet-preview-details';
  const caption = document.createElement('caption');
  caption.className = 'visually-hidden';
  caption.textContent = 'Page setup';
  const detailRows = document.createElement('tbody');
  details.append(caption, detailRows);

  const body = document.createElement('div');
  body.className = 'sheet-preview-body';
  body.append(details, stage);

  dialog.append(close, body);

  let shown: PreviewSheet | null = null;

  /** Fit the page to the stage, drawn sharp at the screen's pixel density. */
  function draw(): void {
    if (!shown) return;
    const { sheet, config, options, fontFamily } = shown;
    // Room for the paper's outline, drawn outside it.
    const room = 2 * OUTLINE;
    const fit = Math.min(
      (stage.clientWidth - room) / sheet.page.width,
      (stage.clientHeight - room) / sheet.page.height,
    );
    const dpr = window.devicePixelRatio || 1;

    // Whole device pixels, rounded down, and shown at exactly that size.
    // The paper is filled to the page's scaled size, so a canvas rounded up
    // would leave its last column part filled, a grey seam against the
    // outline; one shown a fraction over would stretch that column likewise.
    canvas.width = Math.floor(sheet.page.width * fit * dpr);
    canvas.height = Math.floor(sheet.page.height * fit * dpr);
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;

    drawSheetToCanvas(canvas.getContext('2d')!, sheet, config, {
      ...options,
      fontFamily,
      scale: fit * dpr,
      // The page's paper colour, as the row previews show it.
      background: getComputedStyle(dialog).getPropertyValue('--color-white').trim(),
    });
  }

  const onResize = () => draw();

  /** Bumped on every open, so a close still sliding can't shut a reopen. */
  let opened = 0;

  function hide(): void {
    window.removeEventListener('resize', onResize);
    dialog.classList.remove('is-open');

    // Close once it has slid away: on the slide's end, or after its length
    // in case that never comes (a hidden tab runs no transitions). At once
    // if there's no slide to wait for.
    const slide = parseFloat(getComputedStyle(dialog).transitionDuration) * 1000;
    const token = opened;
    const finish = () => {
      if (token === opened && dialog.open) dialog.close();
    };
    if (slide > 0) {
      dialog.addEventListener('transitionend', (event) => event.target === dialog && finish(), {
        once: true,
      });
      setTimeout(finish, slide + 50);
    } else {
      finish();
    }
  }

  close.addEventListener('click', hide);
  // Escape: slide away rather than vanish.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    hide();
  });

  return {
    element: dialog,
    open(content) {
      opened++;
      if ('message' in content) {
        shown = null;
        message.textContent = content.message;
        stage.replaceChildren(message);
        details.hidden = true;
      } else {
        shown = content;
        stage.replaceChildren(canvas);
        detailRows.replaceChildren(
          ...pageRows(content.page).map(([name, value]) => {
            const row = document.createElement('tr');
            const th = document.createElement('th');
            th.scope = 'row';
            th.className = 'ui-sm';
            th.textContent = name;
            const td = document.createElement('td');
            td.className = 'body-md';
            td.textContent = value;
            row.append(th, td);
            return row;
          }),
        );
        details.hidden = false;
      }

      if (!dialog.open) {
        dialog.showModal();
        dialog.focus();
      }
      draw();
      window.addEventListener('resize', onResize);
      // Lay it out above the screen first, so adding the class slides it
      // down rather than placing it there.
      dialog.getBoundingClientRect();
      dialog.classList.add('is-open');
    },
  };
}
