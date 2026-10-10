/**
 * Controls for the sheet as a whole, set above the rows: how many rows it
 * has, and whether they share their metrics.
 */

let nextId = 0;

export const MIN_ROWS = 1;
export const MAX_ROWS = 6;

export interface Stop {
  value: number;
  /** Shown under the stop. */
  label: string;
}

/**
 * A slider with a stop for each value, labelled underneath. Stops are whole
 * numbers one apart. A native range input, so keyboard and screen readers get
 * the usual slider behaviour; only its look is custom.
 */
export function createStopSlider(
  name: string,
  stops: Stop[],
  value: number,
  onChange: (value: number) => void,
): HTMLElement {
  const id = `sheet-control-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control';

  const label = document.createElement('label');
  label.className = 'ui-sm sheet-control-name';
  label.htmlFor = id;
  label.textContent = name;

  const input = document.createElement('input');
  input.className = 'stop-slider-input';
  input.type = 'range';
  input.id = id;
  input.min = String(stops[0]!.value);
  input.max = String(stops.at(-1)!.value);
  input.step = '1';
  input.value = String(value);
  // A worded stop is announced by its word, not its number.
  const valueText = () => {
    const stop = stops.find((s) => s.value === Number(input.value));
    if (stop && stop.label !== String(stop.value)) input.setAttribute('aria-valuetext', stop.label);
  };
  valueText();

  // The stop labels. The slider already announces its value, so these are
  // for the eye only.
  const labels = document.createElement('div');
  labels.className = 'ui-xs stop-slider-stops';
  labels.setAttribute('aria-hidden', 'true');
  for (const stop of stops) {
    const span = document.createElement('span');
    span.textContent = stop.label;
    labels.append(span);
  }

  const mark = () => {
    Array.from(labels.children).forEach((span, i) =>
      span.classList.toggle('is-current', stops[i]!.value === Number(input.value)),
    );
  };
  mark();

  input.addEventListener('input', () => {
    mark();
    valueText();
    onChange(Number(input.value));
  });

  const slider = document.createElement('div');
  slider.className = 'stop-slider';
  slider.style.setProperty('--stops', String(stops.length));
  slider.append(input, labels);

  control.append(label, slider);
  return control;
}

/** "Number of rows": a stop for each count, 1 to 6, numbered underneath. */
export function createRowCountSlider(
  value: number,
  onChange: (count: number) => void,
): HTMLElement {
  const stops = Array.from({ length: MAX_ROWS - MIN_ROWS + 1 }, (_, i) => {
    const n = MIN_ROWS + i;
    return { value: n, label: String(n) };
  });
  return createStopSlider('Number of rows', stops, value, onChange);
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
