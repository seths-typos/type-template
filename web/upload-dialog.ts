import { FontImportError, type FontMaster, type FontMetrics } from './import/font-source.js';
import { SheetFileError } from './sheet-file.js';
import { UploadError, droppedFile, pickFile, type UploadFile } from './upload.js';

export interface UploadDialog {
  element: HTMLDialogElement;
  /** Open on the drop area. */
  open(): void;
  close(): void;
  /**
   * Ask which master to take. Null if the user goes back to the drop area
   * or closes the dialog.
   */
  chooseMaster(file: string, masters: FontMaster[]): Promise<FontMaster | null>;
}

/** The metrics in the rows' order, as the master list shows them. */
const SUMMARY: { key: keyof FontMetrics; name: string; unit?: string }[] = [
  { key: 'ascender', name: 'Asc' },
  { key: 'capHeight', name: 'Cap' },
  { key: 'xHeight', name: 'x' },
  { key: 'descender', name: 'Desc' },
  { key: 'italicAngle', name: 'Angle', unit: '°' },
];

function summary(metrics: FontMetrics): string {
  return SUMMARY.filter(({ key }) => metrics[key] !== undefined && metrics[key] !== 0)
    .map(({ key, name, unit = '' }) => `${name} ${String(metrics[key]).replace('-', '−')}${unit}`)
    .join(' · ');
}

/** Why an upload failed: its own message, where it has one for the user. */
function describe(error: unknown): string {
  if (
    error instanceof FontImportError ||
    error instanceof SheetFileError ||
    error instanceof UploadError
  ) {
    return error.message;
  }
  console.error(error);
  return 'That couldn’t be read.';
}

function button(label: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  // Read by the stylesheet to hold the width of the label at its hover weight.
  b.dataset.label = label;
  return b;
}

/**
 * Upload Config: a modal with a drop area for a config or a font source,
 * and a file picker that takes the same — a .json, .glyphs, .ufo or
 * .glyphspackage. What is
 * chosen goes to `onUpload`; if that throws, the reason shows under the drop
 * area so another can be tried at once. A font with masters to choose
 * between turns the dialog to a list of them.
 *
 * Escape or Cancel closes it having changed nothing.
 */
export function createUploadDialog(onUpload: (file: UploadFile) => Promise<void>): UploadDialog {
  const dialog = document.createElement('dialog');
  dialog.className = 'upload-dialog';
  dialog.setAttribute('aria-labelledby', 'upload-dialog-title');

  const title = document.createElement('h2');
  title.className = 'heading-h2 upload-dialog-title';
  title.id = 'upload-dialog-title';

  const text = document.createElement('p');
  text.className = 'body-md upload-dialog-text';

  // The drop view.
  const zone = document.createElement('div');
  zone.className = 'upload-zone';
  const zoneText = document.createElement('p');
  zoneText.className = 'ui-md upload-zone-text';
  zoneText.textContent = 'Drop a file here';
  const or = document.createElement('p');
  or.className = 'body-sm upload-zone-or';
  or.textContent = 'or';
  const chooseFile = button('Choose File', 'action-button');
  const pickers = document.createElement('div');
  pickers.className = 'upload-zone-pickers';
  pickers.append(chooseFile);
  zone.append(zoneText, or, pickers);

  const error = document.createElement('p');
  error.className = 'body-md upload-dialog-error';
  error.setAttribute('role', 'alert');

  // The file is read in the browser and let go: nothing is sent or kept.
  const privacy = document.createElement('p');
  privacy.className = 'body-sm upload-dialog-note';
  privacy.textContent =
    'Your file isn’t uploaded or saved. Sheet-o-matic only reads its metrics to set up your rows.';

  const dropView = document.createElement('div');
  dropView.className = 'upload-dialog-view';
  dropView.append(zone, error, privacy);

  // The master view.
  const choices = document.createElement('div');
  choices.className = 'upload-dialog-choices';

  const footer = button('Cancel', 'action-button upload-dialog-footer');

  dialog.append(title, text, dropView, choices, footer);

  /** The master being asked for, settled by a choice, Back or closing. */
  let settle: ((master: FontMaster | null) => void) | null = null;
  const answer = (master: FontMaster | null) => {
    const resolve = settle;
    settle = null;
    resolve?.(master);
  };

  function showDrop(message = ''): void {
    answer(null);
    title.textContent = 'Upload Config';
    text.textContent =
      'A saved config, or a font’s metrics from a Glyphs 3 file (.glyphs or .glyphspackage) or a UFO.';
    dropView.hidden = false;
    choices.hidden = true;
    choices.replaceChildren();
    error.textContent = message;
    footer.textContent = footer.dataset.label = 'Cancel';
  }

  /** Hand over what was chosen; show why, if it can't be used. */
  async function take(pick: () => Promise<UploadFile | null>): Promise<void> {
    error.textContent = '';
    try {
      const file = await pick();
      if (file) await onUpload(file);
    } catch (failure) {
      if (dialog.open) showDrop(describe(failure));
    }
  }

  chooseFile.addEventListener('click', () => take(pickFile));

  // Over the zone, it shows it will take the drop.
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
  zone.addEventListener('dragover', (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', (event) => {
    if (!zone.contains(event.relatedTarget as Node | null)) zone.classList.remove('is-over');
  });
  zone.addEventListener('drop', (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    zone.classList.remove('is-over');
    const data = event.dataTransfer!;
    // Read the drop now: its items are gone once this handler returns.
    const dropped = droppedFile(data);
    take(() => dropped);
  });
  // A file let go anywhere else would replace the page with itself.
  for (const type of ['dragover', 'drop'] as const) {
    window.addEventListener(type, (event) => {
      if (carriesFiles(event) && !event.defaultPrevented) {
        event.preventDefault();
        event.dataTransfer!.dropEffect = 'none';
      }
    });
  }

  footer.addEventListener('click', () => {
    // Back from the masters, or out.
    if (settle) showDrop();
    else dialog.close();
  });
  dialog.addEventListener('close', () => answer(null));

  return {
    element: dialog,
    open() {
      showDrop();
      if (!dialog.open) dialog.showModal();
      chooseFile.focus();
    },
    close() {
      if (dialog.open) dialog.close();
    },
    chooseMaster(file, masters) {
      answer(null);
      title.textContent = 'Choose a master';
      text.textContent = `${file} has ${masters.length} masters with different metrics. Which should the rows use?`;
      dropView.hidden = true;
      choices.hidden = false;
      choices.replaceChildren(
        ...masters.map((master) => {
          const choice = document.createElement('button');
          choice.type = 'button';
          choice.className = 'upload-dialog-choice';
          const name = document.createElement('span');
          name.className = 'ui-md';
          name.textContent = master.name;
          const values = document.createElement('span');
          values.className = 'body-sm';
          values.textContent = summary(master.metrics);
          choice.append(name, values);
          choice.addEventListener('click', () => answer(master));
          return choice;
        }),
      );
      footer.textContent = footer.dataset.label = 'Back';
      const chosen = new Promise<FontMaster | null>((resolve) => (settle = resolve));
      (choices.firstElementChild as HTMLElement | null)?.focus();
      return chosen;
    },
  };
}
