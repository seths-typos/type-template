import { FontImportError, type FontMetrics, type FontSource } from './font-source.js';

/** fontinfo.plist's keys, as the app names them. */
const KEYS: Record<string, keyof FontMetrics> = {
  ascender: 'ascender',
  capHeight: 'capHeight',
  xHeight: 'xHeight',
  descender: 'descender',
  italicAngle: 'italicAngle',
};

/**
 * A UFO's `fontinfo.plist`: an XML property list of top-level keys, so the
 * numbers are read straight off it. A UFO is one master, named by its style.
 *
 * UFO counts the italic angle the other way round — a right lean is negative
 * — so its sign is flipped into the app's convention.
 */
export function readUfoFontInfo(xml: string): FontSource {
  if (!/<plist[\s>]/.test(xml)) throw new FontImportError("This fontinfo.plist couldn't be read.");

  const metrics: FontMetrics = {};
  let styleName: string | undefined;
  const entry = /<key>\s*([^<]*?)\s*<\/key>\s*<(integer|real|string)>\s*([^<]*?)\s*<\/\2>/g;
  for (const [, key, type, raw] of xml.matchAll(entry)) {
    if (key === 'styleName' && type === 'string') styleName = unescape(raw!);
    const name = KEYS[key!];
    if (!name || type === 'string') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) metrics[name] = value;
  }
  if (metrics.italicAngle !== undefined) metrics.italicAngle = -metrics.italicAngle || 0;

  return { format: 'UFO', masters: [{ name: styleName || 'Regular', metrics }] };
}

function unescape(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
