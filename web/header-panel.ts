/**
 * Header: optional text set across the top of the printed page — on the
 * left, in the centre and on the right. An outlined block like Line Styles,
 * a line of explanation, then a text field for each place.
 */

export interface HeaderText {
  left: string;
  center: string;
  right: string;
}

export function emptyHeaderText(): HeaderText {
  return { left: '', center: '', right: '' };
}

const PLACES: { key: keyof HeaderText; name: string }[] = [
  { key: 'left', name: 'Left' },
  { key: 'center', name: 'Center' },
  { key: 'right', name: 'Right' },
];

let nextId = 0;

/** Edits `text` in place as the fields change. */
export function createHeaderPanel(text: HeaderText): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'block is-outlined header-panel';

  const title = document.createElement('h2');
  title.className = 'heading-h2 block-title';
  title.textContent = '3. Header';

  const info = document.createElement('p');
  info.className = 'body-md header-panel-info';
  info.textContent = 'Optional text, printed across the top of the page.';

  const fields = document.createElement('div');
  fields.className = 'header-fields';

  for (const { key, name } of PLACES) {
    const id = `header-${key}-${nextId++}`;

    const label = document.createElement('label');
    label.className = 'ui-sm header-field-name';
    label.htmlFor = id;
    label.textContent = name;

    const input = document.createElement('input');
    input.className = 'body-md header-field-input';
    input.type = 'text';
    input.id = id;
    input.value = text[key];
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      text[key] = input.value;
    });

    // The rule that draws across under the field while it has focus.
    const border = document.createElement('span');
    border.className = 'header-field-border';
    border.setAttribute('aria-hidden', 'true');

    const field = document.createElement('div');
    field.className = 'header-field';
    field.append(input, border);

    fields.append(label, field);
  }

  // The title on its own; the note heads the fields beside it.
  const top = document.createElement('div');
  top.className = 'header-panel-top';
  top.append(title);

  const body = document.createElement('div');
  body.className = 'header-body';
  body.append(info, fields);

  panel.append(top, body);
  return panel;
}
