/** A colour in the 0–1 component range both pdf-lib and canvas want. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse `#rgb` or `#rrggbb` into 0–1 components. */
export function parseHexColor(hex: string): Rgb {
  const match = HEX.exec(hex.trim());

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
