import { describe, expect, it } from 'vitest';
import { FIELDS, resolveConfig } from '../../src/index.js';
import { setAt } from '../paths.js';
import { controlKind, initialValue, parseValue } from '../values.js';

/** What `form.read()` returns for a form nobody has touched yet. */
function untouchedForm(): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  for (const field of FIELDS) {
    const parsed = parseValue(controlKind(field), initialValue(field));

    if (parsed.set) setAt(input, field.path, parsed.value);
  }

  return input;
}

describe('the form round trip', () => {
  // The invariant the whole generated form rests on: open the page untouched
  // and you are looking at exactly the engine's defaults, not an approximation.
  it('reconstructs the engine defaults from the starting control values', () => {
    expect(resolveConfig(untouchedForm())).toEqual(resolveConfig({}));
  });

  it('leaves out the one field with no default', () => {
    expect(untouchedForm()).not.toHaveProperty('slant.angle');
    expect(parseValue('number', '')).toEqual({ set: false });
  });

  it('gives every field a control', () => {
    for (const field of FIELDS) {
      expect(controlKind(field), field.path).toBeTruthy();
    }
  });
});

describe('controlKind', () => {
  const kindOf = (path: string) => controlKind(FIELDS.find((f) => f.path === path)!);

  it('picks a control from the field spec', () => {
    expect(kindOf('page.size')).toBe('select');
    expect(kindOf('page.orientation')).toBe('select');
    expect(kindOf('metrics.capHeight')).toBe('number');
    expect(kindOf('metrics.rowCount')).toBe('number');
    expect(kindOf('header.enabled')).toBe('boolean');
    expect(kindOf('header.left')).toBe('text');
    expect(kindOf('lines.baseline.color')).toBe('color');
    expect(kindOf('lines.baseline.dash')).toBe('dash');
  });
});

describe('parseValue', () => {
  it('reads a dash as null or an array of lengths', () => {
    expect(parseValue('dash', 'null')).toEqual({ set: true, value: null });
    expect(parseValue('dash', '[3, 3]')).toEqual({ set: true, value: [3, 3] });
  });

  it('treats a cleared dash as unset, like every other field', () => {
    // Otherwise clearing x-height's [3,3] would silently mean solid rather
    // than "put the default back". Type `null` for solid.
    expect(parseValue('dash', '')).toEqual({ set: false });
  });

  it('passes a malformed dash through for config to report', () => {
    // Better a named error than the form quietly dropping what you typed.
    expect(parseValue('dash', '3 3')).toEqual({ set: true, value: '3 3' });
    expect(() => resolveConfig({ lines: { baseline: { dash: '3 3' } } as never })).toThrow(
      /lines.baseline.dash/,
    );
  });

  it('keeps an empty text field, since empty header text is real', () => {
    expect(parseValue('text', '')).toEqual({ set: true, value: '' });
  });

  it('treats a cleared number as unset so the default comes back', () => {
    expect(parseValue('number', '')).toEqual({ set: false });
    expect(parseValue('number', '96')).toEqual({ set: true, value: 96 });
  });
});
