import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../defaults.js';
import { DEFAULTLESS, FIELDS } from '../fields.js';
import { resolveConfig } from '../index.js';

function leafPaths(value: unknown, prefix = ''): string[] {
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isObject = typeof child === 'object' && child !== null && !Array.isArray(child);

    return isObject ? leafPaths(child, path) : [path];
  });
}

describe('FIELDS', () => {
  // Without this the report is just a second thing to maintain.
  it('describes exactly the input surface, no more and no less', () => {
    const described = new Set(FIELDS.map((field) => field.path));
    const actual = new Set([...leafPaths(DEFAULTS), ...DEFAULTLESS]);

    expect([...described].sort()).toEqual([...actual].sort());
  });

  it('prints defaults that match the ones actually applied', () => {
    const config = resolveConfig();

    expect(FIELDS.find((f) => f.path === 'metrics.capHeight')?.default).toBe(
      String(config.metrics.capHeight),
    );
    expect(FIELDS.find((f) => f.path === 'lines.xHeight.dash')?.default).toBe(
      JSON.stringify(config.lines.xHeight.dash),
    );
  });

  it('marks the one field with no default', () => {
    const angle = FIELDS.find((field) => field.path === 'slant.angle');

    expect(angle?.default).toBeUndefined();
    expect(angle?.notes).toContain('REQUIRED');
  });

  it('gives every field a type', () => {
    for (const field of FIELDS) {
      expect(field.type, field.path).not.toBe('');
    }
  });
});
