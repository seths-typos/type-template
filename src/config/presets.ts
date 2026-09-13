/**
 * Page presets. Users pick one from this list — there is no free-form
 * width/height input, so orientation always has well-defined dimensions to
 * reorder.
 *
 * Values are DTP points (1 pt = 1/72 inch), stored in their portrait
 * orientation. Adding a preset is one entry here.
 *
 * Candidates not yet added: legal, iPad screen sizes. Note that Apple's
 * "points" are device-independent pixels at roughly 1/163 inch, NOT DTP
 * points — a screen preset has to be converted to physical size first, here
 * at the config boundary, never downstream.
 */
export const PAGE_PRESETS = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
} as const;

export type PagePreset = keyof typeof PAGE_PRESETS;

export type Orientation = 'portrait' | 'landscape';

export const PAGE_PRESET_NAMES = Object.keys(PAGE_PRESETS) as PagePreset[];

/**
 * Resolve a preset and orientation into page dimensions in points.
 *
 * This is the only place a page size stops being a name. Geometry receives
 * numbers and never sees the preset.
 */
export function resolvePageSize(
  preset: PagePreset,
  orientation: Orientation,
): { width: number; height: number } {
  const base = PAGE_PRESETS[preset];

  if (!base) {
    throw new Error(
      `Unknown page preset '${preset}'. Available: ${PAGE_PRESET_NAMES.join(', ')}.`,
    );
  }

  return orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}
