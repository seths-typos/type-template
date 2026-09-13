import { describe, expect, it } from 'vitest';
import { parseHexColor } from '../color.js';

describe('parseHexColor', () => {
  it('parses six-digit hex into 0–1 components', () => {
    expect(parseHexColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('parses the default grey', () => {
    const grey = 0x88 / 255;
    expect(parseHexColor('#888888')).toEqual({ r: grey, g: grey, b: grey });
  });

  it('expands three-digit shorthand', () => {
    expect(parseHexColor('#f00')).toEqual(parseHexColor('#ff0000'));
  });

  it('tolerates case, whitespace and a missing hash', () => {
    expect(parseHexColor('  #AABBCC ')).toEqual(parseHexColor('#aabbcc'));
    expect(parseHexColor('aabbcc')).toEqual(parseHexColor('#aabbcc'));
  });

  it('rejects anything else', () => {
    for (const bad of ['', '#12345', 'rebeccapurple', '#gggggg']) {
      expect(() => parseHexColor(bad)).toThrow(/Invalid hex color/);
    }
  });
});
