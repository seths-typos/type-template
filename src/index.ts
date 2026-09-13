import type { SheetConfig } from './config/types.js';
import { buildSheet } from './geometry/index.js';
import { renderSheetPdf } from './render/pdf/index.js';
import type { DrawOptions } from './render/pdf/index.js';

export { buildSheet } from './geometry/index.js';
export { renderSheetPdf } from './render/pdf/index.js';
export { PAGE_PRESETS, PAGE_PRESET_NAMES, resolvePageSize } from './config/presets.js';
export type { PagePreset, Orientation } from './config/presets.js';
export type * from './config/types.js';
export type * from './geometry/types.js';

/** Config in, PDF out. */
export async function createSheetPdf(
  config: SheetConfig,
  options: DrawOptions = {},
): Promise<Uint8Array> {
  return renderSheetPdf(buildSheet(config), config, options);
}
