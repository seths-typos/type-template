/**
 * Controls for the sheet as a whole, set above the rows: how many rows it
 * has, and whether they share their metrics.
 */

let nextId = 0;

export const MIN_ROWS = 1;
export const MAX_ROWS = 6;

/**
 * "Number of rows": a slider with a stop for each count, 1 to 6, numbered
 * underneath. A native range input, so keyboard and screen readers get the
 * usual slider behaviour; only its look is custom.
 */
export function createRowCountSlider(
  value: number,
  onChange: (count: number) => void,
): HTMLElement {
  const id = `sheet-control-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control';

  const label = document.createElement('label');
  label.className = 'ui-sm sheet-control-name';
  label.htmlFor = id;
  label.textContent = 'Number of rows';

  const input = document.createElement('input');
  input.className = 'row-count';
  input.type = 'range';
  input.id = id;
  input.min = String(MIN_ROWS);
  input.max = String(MAX_ROWS);
  input.step = '1';
  input.value = String(value);

  // The stop numbers. The slider already announces its value, so these are
  // for the eye only.
  const stops = document.createElement('div');
  stops.className = 'ui-xs row-count-stops';
  stops.setAttribute('aria-hidden', 'true');
  for (let n = MIN_ROWS; n <= MAX_ROWS; n++) {
    const stop = document.createElement('span');
    stop.textContent = String(n);
    stops.append(stop);
  }

  const mark = () => {
    Array.from(stops.children).forEach((stop, i) =>
      stop.classList.toggle('is-current', i + MIN_ROWS === Number(input.value)),
    );
  };
  mark();

  input.addEventListener('input', () => {
    mark();
    onChange(Number(input.value));
  });

  const slider = document.createElement('div');
  slider.className = 'row-count-slider';
  slider.append(input, stops);

  control.append(label, slider);
  return control;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/**
 * A two-way switch in the toggles' style: a white shell with its bottom-left
 * and top-right corners cut, the chosen option white and the other red.
 * Radio buttons underneath, so arrow keys move between the options.
 */
export function createChoiceToggle<T extends string>(
  name: string,
  choices: Choice<T>[],
  value: T,
  onChange: (value: T) => void,
): HTMLElement {
  const id = `sheet-control-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control';
  control.setAttribute('role', 'radiogroup');
  control.setAttribute('aria-labelledby', id);

  const label = document.createElement('span');
  label.className = 'ui-sm sheet-control-name';
  label.id = id;
  label.textContent = name;

  const shell = document.createElement('div');
  shell.className = 'choice';

  for (const choice of choices) {
    const option = document.createElement('label');
    option.className = 'choice-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = id;
    radio.value = choice.value;
    radio.checked = choice.value === value;
    radio.addEventListener('change', () => {
      if (radio.checked) onChange(choice.value);
    });

    const text = document.createElement('span');
    text.textContent = choice.label;

    option.append(radio, text);
    shell.append(option);
  }

  control.append(label, shell);
  return control;
}
