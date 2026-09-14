import { ConfigError, buildSheet, createSheetPdf, resolveConfig } from '../src/index.js';
import { drawSheetToCanvas } from '../src/render/canvas/index.js';
import { buildForm } from './form.js';
import { measure, previewSize } from './preview.js';

const form = buildForm(document.querySelector('#form')!, () => render());
const canvas = document.querySelector<HTMLCanvasElement>('#preview')!;
const status = document.querySelector<HTMLElement>('#status')!;
const ctx = canvas.getContext('2d')!;

/** The last input that resolved, so a broken edit keeps its preview. */
let lastGood: Record<string, unknown> = {};

function render(): void {
  const input = form.read();

  try {
    const config = resolveConfig(input);
    const sheet = buildSheet(config);

    form.showIssues([]);
    lastGood = input;

    // Measure the content box, not the padded one, and let CSS lay the canvas
    // out at 100% width. Sizing it in pixels here let it push its own
    // container wider on every render.
    const size = previewSize(
      measure(canvas.parentElement!),
      sheet.page,
      window.devicePixelRatio || 1,
    );

    canvas.width = size.width;
    canvas.height = size.height;

    drawSheetToCanvas(ctx, sheet, config, { scale: size.scale });

    status.textContent =
      `${sheet.page.width} x ${sheet.page.height} pt · ${sheet.rows.length} rows · ` +
      `cap height ${sheet.capHeight.toFixed(2)} pt · band ${sheet.totalMetricHeight.toFixed(2)} pt`;
    status.classList.remove('bad');
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;

    form.showIssues(error.issues);
    status.textContent = `${error.issues.length} problem${
      error.issues.length === 1 ? '' : 's'
    } — showing the last sheet that resolved`;
    status.classList.add('bad');
  }
}

document.querySelector('#download')!.addEventListener('click', async () => {
  const bytes = await createSheetPdf(lastGood);
  // Copy into a plain ArrayBuffer — a Uint8Array over ArrayBufferLike is not
  // a BlobPart as far as TypeScript is concerned.
  const buffer = new Uint8Array(bytes).buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = 'practice-sheet.pdf';
  link.click();

  URL.revokeObjectURL(url);
});

document.querySelector('#copy')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(lastGood, null, 2));
  status.textContent = 'config copied — paste it into scripts/proof.ts';
});

window.addEventListener('resize', () => render());

render();
