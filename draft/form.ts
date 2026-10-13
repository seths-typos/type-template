import { FIELDS, type ConfigIssue, type FieldSpec } from '../src/index.js';
import { clearAt, setAt } from './paths.js';
import { controlKind, initialValue, parseValue, type ControlKind } from './values.js';

/**
 * The form is generated from `config/fields.ts` rather than written by hand.
 * A test already asserts that table covers the input surface exactly, so the
 * form cannot fall behind the engine.
 */
export interface FormHandle {
  /** The raw SheetInput the controls currently describe. */
  read(): Record<string, unknown>;
  showIssues(issues: readonly ConfigIssue[]): void;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const leaf = (path: string) => path.slice(path.indexOf('.') + 1);

export function buildForm(root: HTMLElement, onChange: () => void): FormHandle {
  const controls = new Map<string, Control>();
  const errors = new Map<string, HTMLElement>();

  for (const [section, fields] of groupBySection()) {
    const block = document.createElement('details');
    block.open = section === 'page' || section === 'metrics';

    const summary = document.createElement('summary');
    summary.textContent = section;
    block.append(summary);

    for (const field of fields) {
      const { row, control, error } = buildRow(field, onChange);

      controls.set(field.path, control);
      errors.set(field.path, error);
      block.append(row);
    }

    root.append(block);
  }

  return {
    read: () => readInput(controls),
    showIssues(issues) {
      for (const [path, element] of errors) {
        const issue = issues.find((candidate) => candidate.path === path);

        element.textContent = issue ? issue.message : '';
        controls.get(path)!.classList.toggle('invalid', Boolean(issue));
      }
    },
  };
}

function groupBySection(): Map<string, FieldSpec[]> {
  const sections = new Map<string, FieldSpec[]>();

  for (const field of FIELDS) {
    const section = field.path.slice(0, field.path.indexOf('.'));
    sections.set(section, [...(sections.get(section) ?? []), field]);
  }

  return sections;
}

function buildRow(field: FieldSpec, onChange: () => void) {
  const row = document.createElement('label');
  row.className = 'field';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = leaf(field.path);
  name.title = [field.options?.join(' | '), field.notes].filter(Boolean).join('; ');

  const control = buildControl(field);
  control.addEventListener('input', onChange);
  control.addEventListener('change', onChange);

  const unit = document.createElement('span');
  unit.className = 'unit';
  unit.textContent = field.unit ?? '';

  const error = document.createElement('span');
  error.className = 'error';

  row.append(name, control, unit, error);

  return { row, control, error };
}

function buildControl(field: FieldSpec): Control {
  const kind = controlKind(field);
  const value = initialValue(field);
  const control = createControl(field, kind, value);

  control.dataset.kind = kind;

  return control;
}

function createControl(field: FieldSpec, kind: ControlKind, value: string): Control {
  if (kind === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value === 'true';

    return input;
  }

  if (kind === 'select') {
    const select = document.createElement('select');

    for (const option of field.options!) {
      const element = document.createElement('option');
      element.value = option;
      element.textContent = option;
      select.append(element);
    }

    select.value = value;

    return select;
  }

  if (kind === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = field.type === 'integer' ? '1' : 'any';
    input.value = value;
    // The one field with no default: leave it empty and let config ask for it.
    input.placeholder = field.default === undefined ? 'required' : '';

    return input;
  }

  if (kind === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;

    return input;
  }

  if (kind === 'dash') {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    // Blank falls back to the default, like every other field. `null` is how
    // you ask for a solid line.
    input.placeholder = 'default';

    return input;
  }

  // Header text is the only multi-line field.
  const input = document.createElement(field.path.startsWith('header.') ? 'textarea' : 'input');
  input.value = value;

  return input as Control;
}

function readInput(controls: Map<string, Control>): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  for (const [path, control] of controls) {
    const kind = control.dataset.kind as ControlKind;
    const raw =
      kind === 'boolean' ? String((control as HTMLInputElement).checked) : control.value;
    const parsed = parseValue(kind, raw);

    if (parsed.set) {
      setAt(input, path, parsed.value);
    } else {
      clearAt(input, path);
    }
  }

  return input;
}
