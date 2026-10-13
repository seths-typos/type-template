import { createChoiceToggle } from './sheet-controls.js';
import type { PageSetup } from './sheet-preview.js';

/**
 * Page Setup: the paper the sheet prints on — its orientation and its size.
 * Edits `page` in place.
 */
export function createPageSetupPanel(page: PageSetup): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'block is-outlined page-setup';

  const title = document.createElement('h2');
  title.className = 'heading-h2 block-title';
  title.textContent = 'Page Setup';

  const controls = document.createElement('div');
  controls.className = 'page-setup-controls';
  controls.append(
    createChoiceToggle(
      'Orientation',
      [
        { value: 'portrait', label: 'Portrait' },
        { value: 'landscape', label: 'Landscape' },
      ],
      page.orientation,
      (orientation) => {
        page.orientation = orientation;
      },
    ),
    createChoiceToggle(
      'Paper',
      [
        { value: 'letter', label: 'Letter' },
        { value: 'a4', label: 'A4' },
      ],
      page.size,
      (size) => {
        page.size = size;
      },
    ),
  );

  controls.append(createMarginField(page));

  panel.append(title, controls);
  return panel;
}

let nextId = 0;

/**
 * Margin: one value in points for all four sides, a whole number of at
 * least 0. A value that isn't one is marked and left out, the last good
 * one standing.
 */
function createMarginField(page: PageSetup): HTMLElement {
  const id = `page-margin-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control page-setup-margin';

  const label = document.createElement('label');
  label.className = 'ui-sm sheet-control-name';
  label.htmlFor = id;
  label.textContent = 'Margin';

  const input = document.createElement('input');
  input.className = 'body-md page-setup-margin-input';
  input.id = id;
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = '0';
  input.step = '1';
  input.value = String(page.margin);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    const valid = input.value.trim() !== '' && Number.isFinite(value) && value >= 0;
    input.setAttribute('aria-invalid', String(!valid));
    if (valid) page.margin = value;
  });

  const unit = document.createElement('span');
  unit.className = 'ui-sm page-setup-margin-unit';
  unit.textContent = 'pt';

  const field = document.createElement('div');
  field.className = 'page-setup-margin-field';
  field.append(input, unit);

  control.append(label, field);
  return control;
}
