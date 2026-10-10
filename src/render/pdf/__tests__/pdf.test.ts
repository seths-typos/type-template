import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../../geometry/index.js';
import { baseConfig } from '../../../testing/fixtures.js';
import { renderSheetPdf } from '../index.js';
import { createSheetPdf } from '../../../index.js';
import { contentStream, strokeCount, textShown } from '../../../testing/pdf.js';

describe('renderSheetPdf', () => {
  it('returns bytes that are a PDF', async () => {
    const config = baseConfig();
    const bytes = await renderSheetPdf(buildSheet(config), config);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('produces one page at the sheet dimensions', async () => {
    const config = baseConfig();
    const bytes = await renderSheetPdf(buildSheet(config), config);
    const reloaded = await PDFDocument.load(bytes);

    expect(reloaded.getPageCount()).toBe(1);

    const { width, height } = reloaded.getPage(0).getSize();
    expect(width).toBeCloseTo(792, 6);
    expect(height).toBeCloseTo(612, 6);
  });

  it('follows the page preset into portrait', async () => {
    const config = baseConfig();
    config.page = { width: 612, height: 792, margins: config.page.margins };

    const bytes = await renderSheetPdf(buildSheet(config), config);
    const { width, height } = (await PDFDocument.load(bytes)).getPage(0).getSize();

    expect(width).toBeCloseTo(612, 6);
    expect(height).toBeCloseTo(792, 6);
  });

  it('strokes one path per visible line', async () => {
    const config = baseConfig();
    const sheet = buildSheet(config);
    const content = await contentStream(await renderSheetPdf(sheet, config));

    expect(strokeCount(content)).toBe(sheet.rows.length * 5);
  });

  it('drops a stroke for every line switched to invisible', async () => {
    const config = baseConfig();
    config.lines.xHeight.visible = false;
    config.lines.descender.visible = false;

    const sheet = buildSheet(config);
    const content = await contentStream(await renderSheetPdf(sheet, config));

    expect(strokeCount(content)).toBe(sheet.rows.length * 3);
  });

  it('writes each style through to the stroke operators', async () => {
    const config = baseConfig();
    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    // X-height is #cb0106, the other metrics #474848. All are 0.5 pt.
    expect(content).toContain(`${0x47 / 255} ${0x48 / 255} ${0x48 / 255} RG`);
    expect(content).toContain(`${0xcb / 255} ${0x01 / 255} ${0x06 / 255} RG`);
    expect(content).toContain('0.5 w');
    expect(content).not.toContain('\n1 w\n');
  });

  it('sets a dash pattern for dashed styles and clears it for solid ones', async () => {
    const config = baseConfig();
    config.lines.xHeight.dash = [3, 2];

    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    expect(content).toContain('[3 2] 0 d');
    expect(content).toContain('[] 0 d');
  });

  it('shows header text only when there is header text', async () => {
    const plain = baseConfig();
    plain.labels.enabled = false;
    const titled = baseConfig();
    titled.labels.enabled = false;
    titled.header.enabled = true;
    titled.header.text = 'Type Cooker brief';

    const without = await contentStream(await renderSheetPdf(buildSheet(plain), plain));
    const withText = await contentStream(await renderSheetPdf(buildSheet(titled), titled));

    expect(textShown(withText)).toEqual(['Type Cooker brief']);
    expect(textShown(without)).toEqual([]);
  });

  it('places the header baseline where the flip puts it', async () => {
    const config = baseConfig();
    config.labels.enabled = false;
    config.header.enabled = true;
    config.header.text = 'brief';

    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    // Block top at y 36 from the page top, first baseline a 12 pt size below,
    // flipped into a 612 pt tall page.
    expect(content).toContain('1 0 0 1 36 564 Tm');
  });

  it('shows each line of a multi-line header', async () => {
    const config = baseConfig();
    config.labels.enabled = false;
    config.header.enabled = true;
    config.header.text = 'brief\ndate';

    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    expect(textShown(content)).toEqual(['brief', 'date']);
  });
});

describe('renderSheetPdf — labels', () => {
  it('right-aligns each label into the margin using the font metrics', async () => {
    const config = baseConfig();
    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    expect(textShown(content)).toContain('B');
    expect(textShown(content)).toContain('C');
    expect(textShown(content)).toContain('X');

    // Helvetica 'B' at 6 pt is 4 pt wide, so a right edge at x 30 starts at 26.
    const placements = [...content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)];
    const xs = placements.map(([, x]) => Number(x));

    expect(Math.max(...xs)).toBeLessThan(30);
    expect(Math.min(...xs)).toBeGreaterThan(0);
  });
});

describe('createSheetPdf', () => {
  it('goes from config straight to PDF bytes', async () => {
    const bytes = await createSheetPdf(baseConfig());

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('matches building the geometry and rendering it separately', async () => {
    const config = baseConfig();

    const direct = await createSheetPdf(config);
    const staged = await renderSheetPdf(buildSheet(config), config);

    expect(direct.byteLength).toBe(staged.byteLength);
  });
});
