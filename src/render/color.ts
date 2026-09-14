import { HEX_COLOR } from '../config/color.js';

/** A colour in the 0–1 component range both pdf-lib and canvas want. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// Config owns the format; this only turns a valid colour into components.

/** Parse `#rgb` or `#rrggbb` into 0–1 components. */
export function parseHexColor(hex: string): Rgb {
  const match = HEX_COLOR.exec(hex.trim());

  if (!match) {
    throw new Error(`Invalid hex color '${hex}'. Expected #rgb or #rrggbb.`);
  }

  const digits = match[1]!;
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;

  const channel = (start: number) => parseInt(full.slice(start, start + 2), 16) / 255;

  return { r: channel(0), g: channel(2), b: channel(4) };
}
