import { resolveConfig } from './config/index.js';
import { buildSheet } from './geometry/index.js';
import { renderSheetPdf } from './render/pdf/index.js';
import type { SheetInput } from './config/types.js';
import type { DrawOptions } from './render/pdf/index.js';

export { resolveConfig, DEFAULTS, ConfigError, FIELDS } from './config/index.js';
export type { ConfigIssue, FieldSpec } from './config/index.js';
export { buildSheet } from './geometry/index.js';
export { renderSheetPdf } from './render/pdf/index.js';
export { PAGE_PRESETS, PAGE_PRESET_NAMES, resolvePageSize } from './config/presets.js';
export type { PagePreset, Orientation } from './config/presets.js';
export type * from './config/types.js';
export type * from './geometry/types.js';

/** Raw config in, PDF out. */
export async function createSheetPdf(
  input: SheetInput = {},
  options: DrawOptions = {},
): Promise<Uint8Array> {
  const config = resolveConfig(input);

  return renderSheetPdf(buildSheet(config), config, options);
}
