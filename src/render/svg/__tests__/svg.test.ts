import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../../geometry/index.js';
import { baseConfig } from '../../../testing/fixtures.js';
import { drawOps } from '../../ops.js';
import { sheetToSvg } from '../index.js';

const count = (svg: string, tag: string) => svg.split(`<${tag} `).length - 1;

describe('sheetToSvg', () => {
  it('sizes the document to the page, in points', () => {
    const config = baseConfig();
    const sheet = buildSheet(config);
    const svg = sheetToSvg(sheet, config);
    const { width, height } = sheet.page;

    expect(svg).toContain(`width="${width}pt" height="${height}pt"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
  });

  it('draws one element per op', () => {
    const config = baseConfig();
    const sheet = buildSheet(config);
    const svg = sheetToSvg(sheet, config);
    const ops = drawOps(sheet, config);

    expect(count(svg, 'line')).toBe(ops.filter((op) => op.kind === 'line').length);
    expect(count(svg, 'text')).toBe(ops.filter((op) => op.kind === 'text').length);
  });

  it('carries dashes and leaves solid lines plain', () => {
    const config = baseConfig();
    const sheet = buildSheet(config);
    const svg = sheetToSvg(sheet, config);
    const dashed = drawOps(sheet, config).filter((op) => op.kind === 'line' && op.dash?.length);

    expect(svg.split('stroke-dasharray=').length - 1).toBe(dashed.length);
  });

  it('escapes text', () => {
    const config = { ...baseConfig(), header: { enabled: true, height: 54, left: 'A < B & "C"', center: '', right: '' } };
    const svg = sheetToSvg(buildSheet(config), config);

    expect(svg).toContain('A &lt; B &amp; "C"');
    expect(svg).not.toContain('A < B');
  });

  it('anchors centred and right-aligned text by its middle and end', () => {
    const config = {
      ...baseConfig(),
      header: { enabled: true, height: 54, left: '', center: 'c', right: 'r' },
    };
    const svg = sheetToSvg(buildSheet(config), config);

    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('text-anchor="end"');
  });
});
