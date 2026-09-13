import { describe, expect, it } from 'vitest';
import { PAGE_PRESET_NAMES, PAGE_PRESETS, resolvePageSize } from '../presets.js';

describe('page presets', () => {
  it('stores presets in points, portrait', () => {
    expect(PAGE_PRESETS.letter).toEqual({ width: 612, height: 792 });
  });

  it('offers letter, the default', () => {
    expect(PAGE_PRESET_NAMES).toContain('letter');
  });

  it('resolves a preset to portrait dimensions', () => {
    expect(resolvePageSize('letter', 'portrait')).toEqual({ width: 612, height: 792 });
  });

  it('swaps the axes for landscape', () => {
    expect(resolvePageSize('letter', 'landscape')).toEqual({ width: 792, height: 612 });
    expect(resolvePageSize('a4', 'landscape')).toEqual({ width: 841.89, height: 595.28 });
  });

  it('names the available presets when given an unknown one', () => {
    // @ts-expect-error — presets are a closed set; this guards the runtime path.
    expect(() => resolvePageSize('tabloid', 'portrait')).toThrow(/Unknown page preset/);
  });
});
