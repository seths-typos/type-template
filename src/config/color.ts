/**
 * Hex colour format, owned by config because it is an input rule. The
 * renderer imports this rather than keeping a second regex that can disagree.
 */
export const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}
