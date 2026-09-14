import { describe, expect, it } from 'vitest';
import { ConfigError } from '../errors.js';
import { resolveConfig } from '../index.js';

/** Every issue path a bad input produced. */
function issuePaths(input: unknown): string[] {
  try {
    resolveConfig(input as Record<string, unknown>);
  } catch (error) {
    if (error instanceof ConfigError) return error.issues.map((issue) => issue.path);
    throw error;
  }

  throw new Error('expected resolveConfig to reject this input');
}

describe('resolveConfig — defaults', () => {
  it('resolves an empty input to the full defaults', () => {
    const config = resolveConfig();

    expect(config.page).toEqual({
      width: 792,
      height: 612,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    });
    expect(config.metrics.capHeight).toBe(72);
    expect(config.metrics.ascender).toBe(105);
    expect(config.lines.xHeight.dash).toEqual([3, 3]);
  });

  it('resolves the preset and orientation into dimensions', () => {
    const portrait = resolveConfig({ page: { orientation: 'portrait' } });
    const a4 = resolveConfig({ page: { size: 'a4' } });

    expect(portrait.page.width).toBe(612);
    expect(portrait.page.height).toBe(792);
    expect(a4.page.width).toBeCloseTo(841.89, 6);
  });

  it('returns a fresh object each call', () => {
    const first = resolveConfig();
    first.metrics.capHeight = 999;

    expect(resolveConfig().metrics.capHeight).toBe(72);
  });
});

describe('resolveConfig — defaults apply field by field', () => {
  it('keeps sibling metrics when one is set', () => {
    const config = resolveConfig({ metrics: { capHeight: 96 } });

    expect(config.metrics.capHeight).toBe(96);
    expect(config.metrics.xHeight).toBe(70);
    expect(config.metrics.rowGap).toBe(36);
  });

  it('keeps the rest of a line style when one property is set', () => {
    const config = resolveConfig({ lines: { xHeight: { dash: null } } });

    expect(config.lines.xHeight).toEqual({
      visible: true,
      weight: 0.5,
      color: '#888888',
      dash: null,
    });
  });

  it('keeps the other margins when one is set', () => {
    const config = resolveConfig({ page: { margins: { left: 72 } } });

    expect(config.page.margins).toEqual({ top: 36, right: 36, bottom: 36, left: 72 });
  });

  it('leaves untouched sections alone', () => {
    const config = resolveConfig({ header: { enabled: true } });

    expect(config.header).toEqual({ enabled: true, height: 54, text: '' });
    expect(config.slant.enabled).toBe(false);
  });
});

describe('resolveConfig — reporting problems', () => {
  it('collects every problem rather than stopping at the first', () => {
    const paths = issuePaths({
      metrics: { capHeight: 0, descender: 20 },
      lines: { baseline: { color: 'rebeccapurple' } },
    });

    expect(paths).toEqual([
      'metrics.capHeight',
      'metrics.descender',
      'lines.baseline.color',
    ]);
  });

  it('names the field and what was wrong with it', () => {
    try {
      resolveConfig({ metrics: { xHeight: -5 } });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues[0]).toEqual({
        path: 'metrics.xHeight',
        message: 'must be greater than 0, got -5',
      });
      expect((error as ConfigError).message).toContain('metrics.xHeight');
      return;
    }

    throw new Error('expected a ConfigError');
  });

  it('rejects wrong types, not just out-of-range values', () => {
    expect(issuePaths({ metrics: { capHeight: '72' } })).toEqual(['metrics.capHeight']);
    expect(issuePaths({ header: { enabled: 'yes' } })).toEqual(['header.enabled']);
    expect(issuePaths({ metrics: 7 })).toEqual(['metrics']);
  });
});

describe('resolveConfig — metric rules', () => {
  it('requires the descender to be at or below the baseline', () => {
    expect(issuePaths({ metrics: { descender: 20 } })).toEqual(['metrics.descender']);
    expect(resolveConfig({ metrics: { descender: 0 } }).metrics.descender).toBe(0);
  });

  it('accepts a face with no ascender, or caps taller than its ascender', () => {
    // The row band follows the metrics that exist rather than assuming an
    // ascender is there to define it.
    expect(resolveConfig({ metrics: { ascender: 100 } }).metrics.ascender).toBe(100);
    expect(resolveConfig({ metrics: { ascender: 90 } }).metrics.ascender).toBe(90);
  });

  it('accepts an x-height reaching above the cap height or the ascender', () => {
    expect(resolveConfig({ metrics: { xHeight: 120 } }).metrics.xHeight).toBe(120);
  });

  it('requires a whole number of rows', () => {
    expect(issuePaths({ metrics: { rowCount: 2.5 } })).toEqual(['metrics.rowCount']);
    expect(issuePaths({ metrics: { rowCount: 0 } })).toEqual(['metrics.rowCount']);
  });

  it('rejects an unknown mode or alignment', () => {
    expect(issuePaths({ metrics: { mode: 'nibWidths' } })).toEqual(['metrics.mode']);
    expect(issuePaths({ metrics: { verticalAlign: 'middle' } })).toEqual([
      'metrics.verticalAlign',
    ]);
  });
});

describe('resolveConfig — slant', () => {
  it('requires an angle when slant is enabled, because it has no default', () => {
    expect(issuePaths({ slant: { enabled: true } })).toEqual(['slant.angle']);
  });

  it('accepts an angle when one is given', () => {
    expect(resolveConfig({ slant: { enabled: true, angle: 12 } }).slant.angle).toBe(12);
  });

  it('does not require an angle when slant is off', () => {
    expect(resolveConfig({ slant: { enabled: false } }).slant.angle).toBe(0);
  });

  it('rejects an angle at or past vertical', () => {
    expect(issuePaths({ slant: { enabled: true, angle: 90 } })).toEqual(['slant.angle']);
  });

  it('rejects a spacing that would never advance', () => {
    expect(issuePaths({ slant: { enabled: true, angle: 10, spacing: 0 } })).toEqual([
      'slant.spacing',
    ]);
  });
});

describe('resolveConfig — lines and labels', () => {
  it('rejects a bad hex colour, dash or weight', () => {
    expect(issuePaths({ lines: { baseline: { color: '#gggggg' } } })).toEqual([
      'lines.baseline.color',
    ]);
    expect(issuePaths({ lines: { baseline: { dash: [3, -1] } } })).toEqual([
      'lines.baseline.dash',
    ]);
    expect(issuePaths({ lines: { baseline: { weight: 0 } } })).toEqual([
      'lines.baseline.weight',
    ]);
  });

  it('accepts shorthand hex and a solid dash', () => {
    const config = resolveConfig({ lines: { baseline: { color: '#f00', dash: null } } });

    expect(config.lines.baseline.color).toBe('#f00');
    expect(config.lines.baseline.dash).toBeNull();
  });

  it('takes the look of the labels but not their text', () => {
    const config = resolveConfig({ labels: { size: 8, color: '#333333' } });

    expect(config.labels).toEqual({ enabled: true, size: 8, color: '#333333', gap: 6 });
  });
});

describe('resolveConfig — the page has to hold something', () => {
  it('rejects margins that consume the width', () => {
    expect(issuePaths({ page: { margins: { left: 400, right: 400 } } })).toEqual(['page.margins']);
  });

  it('blames the header when the header is what fills the page', () => {
    expect(issuePaths({ header: { enabled: true, height: 600 } })).toEqual(['header.height']);
  });

  it('ignores a tall header that is switched off', () => {
    expect(resolveConfig({ header: { enabled: false, height: 600 } }).header.height).toBe(600);
  });
});
