/**
 * Font units: how Glyphs, RoboFont and FontLab enter vertical metrics.
 * Each metric is a height above the baseline (0) in units of the em, usually
 * 1000 per em, with the descender negative.
 *
 * The engine measures metrics as a percentage of the cap height, so this is a
 * unit conversion and lives here at the config boundary. Only the ratios
 * between metrics matter: the em size itself never reaches the sheet.
 */
export interface FontUnitMetrics {
  ascender: number;
  capHeight: number;
  xHeight: number;
  descender: number;
}

/**
 * A common starting point for a 1000-unit em, with all four lines distinct.
 * RoboFont's new-font defaults (750 / 750 / 500 / -250) were passed over
 * because their ascender sits on the cap height.
 */
export const DEFAULT_FONT_UNITS: FontUnitMetrics = {
  ascender: 800,
  capHeight: 700,
  xHeight: 500,
  descender: -200,
};

/** Font units to the engine's percentages of cap height. */
export function fontUnitsToPercent(units: FontUnitMetrics): {
  ascender: number;
  xHeight: number;
  descender: number;
} {
  if (!(units.capHeight > 0)) {
    throw new Error(`Cap height must be greater than 0 units, got ${units.capHeight}.`);
  }

  const ofCap = (value: number) => (value / units.capHeight) * 100;

  return {
    ascender: ofCap(units.ascender),
    xHeight: ofCap(units.xHeight),
    descender: ofCap(units.descender),
  };
}
