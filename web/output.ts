import { renderSheetPdf } from '../src/index.js';
import { sheetToSvg } from '../src/render/svg/index.js';
import type { PreviewSheet } from './sheet-preview.js';

/**
 * Print the sheet through the browser's print dialog.
 *
 * The sheet goes on the page as SVG at its true size, in points, and a print
 * stylesheet shows only it, on a page of its size with no margins — the
 * sheet carries its own. Taken off the page again once the dialog closes.
 */
export function printSheet({ sheet, config, options, fontFamily }: PreviewSheet): void {
  const { width, height } = sheet.page;

  const holder = document.createElement('div');
  holder.className = 'print-sheet';
  holder.innerHTML = sheetToSvg(sheet, config, { ...options, fontFamily });

  // @page can't take a custom property, so the size is written in.
  const page = document.createElement('style');
  page.textContent = `@page { size: ${width}pt ${height}pt; margin: 0; }`;

  document.head.append(page);
  document.body.append(holder);

  const cleanUp = () => {
    holder.remove();
    page.remove();
  };
  window.addEventListener('afterprint', cleanUp, { once: true });
  window.print();
}

/** Save the sheet as a PDF, downloaded as `practice-sheet.pdf`. */
export async function saveSheetPdf({ sheet, config, options }: PreviewSheet): Promise<void> {
  const bytes = await renderSheetPdf(sheet, config, options);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = 'practice-sheet.pdf';
  link.click();

  // Let the download take the file before letting it go.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
