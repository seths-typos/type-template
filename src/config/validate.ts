import { isHexColor } from './color.js';
import { ConfigError, type ConfigIssue } from './errors.js';

/**
 * Field readers. Each one returns the default when the field is absent,
 * checks it when present, and records a problem rather than throwing — so a
 * single pass collects everything wrong with the input.
 */
export class Issues {
  private readonly collected: ConfigIssue[] = [];

  add(path: string, message: string): void {
    this.collected.push({ path, message });
  }

  get any(): boolean {
    return this.collected.length > 0;
  }

  throwIfAny(): void {
    if (this.any) throw new ConfigError([...this.collected]);
  }
}

export interface NumberRules {
  above?: number;
  atLeast?: number;
  atMost?: number;
  below?: number;
  integer?: boolean;
}

export function number(
  value: unknown,
  fallback: number,
  path: string,
  issues: Issues,
  rules: NumberRules = {},
): number {
  if (value === undefined) return fallback;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.add(path, `must be a finite number, got ${describe(value)}`);
    return fallback;
  }

  if (rules.integer && !Number.isInteger(value)) {
    issues.add(path, `must be a whole number, got ${value}`);
    return fallback;
  }

  const failed =
    (rules.above !== undefined && !(value > rules.above)) ||
    (rules.atLeast !== undefined && !(value >= rules.atLeast)) ||
    (rules.atMost !== undefined && !(value <= rules.atMost)) ||
    (rules.below !== undefined && !(value < rules.below));

  if (failed) {
    issues.add(path, `must be ${range(rules)}, got ${value}`);
    return fallback;
  }

  return value;
}

export function boolean(value: unknown, fallback: boolean, path: string, issues: Issues): boolean {
  if (value === undefined) return fallback;

  if (typeof value !== 'boolean') {
    issues.add(path, `must be true or false, got ${describe(value)}`);
    return fallback;
  }

  return value;
}

export function text(value: unknown, fallback: string, path: string, issues: Issues): string {
  if (value === undefined) return fallback;

  if (typeof value !== 'string') {
    issues.add(path, `must be a string, got ${describe(value)}`);
    return fallback;
  }

  return value;
}

export function choice<T extends string>(
  value: unknown,
  fallback: T,
  path: string,
  issues: Issues,
  allowed: readonly T[],
): T {
  if (value === undefined) return fallback;

  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.add(path, `must be one of ${allowed.join(', ')}, got ${describe(value)}`);
    return fallback;
  }

  return value as T;
}

export function hexColor(value: unknown, fallback: string, path: string, issues: Issues): string {
  if (value === undefined) return fallback;

  if (!isHexColor(value)) {
    issues.add(path, `must be a hex colour like #888888, got ${describe(value)}`);
    return fallback;
  }

  return value;
}

export function dashArray(
  value: unknown,
  fallback: number[] | null,
  path: string,
  issues: Issues,
): number[] | null {
  if (value === undefined) return fallback;
  if (value === null) return null;

  if (!Array.isArray(value) || value.length === 0) {
    issues.add(path, `must be null for solid, or a non-empty array of lengths`);
    return fallback;
  }

  if (!value.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)) {
    issues.add(path, `must contain only lengths greater than 0, got ${JSON.stringify(value)}`);
    return fallback;
  }

  return [...(value as number[])];
}

/** Objects are the only thing a section can be. */
export function section(value: unknown, path: string, issues: Issues): Record<string, unknown> {
  if (value === undefined) return {};

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.add(path, `must be an object, got ${describe(value)}`);
    return {};
  }

  return value as Record<string, unknown>;
}

function range(rules: NumberRules): string {
  const parts: string[] = [];

  if (rules.above !== undefined) parts.push(`greater than ${rules.above}`);
  if (rules.atLeast !== undefined) parts.push(`at least ${rules.atLeast}`);
  if (rules.below !== undefined) parts.push(`less than ${rules.below}`);
  if (rules.atMost !== undefined) parts.push(`at most ${rules.atMost}`);

  return parts.join(' and ') || 'a number';
}

function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';

  return String(value);
}
