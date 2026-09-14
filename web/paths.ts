/**
 * Dotted-path access, so a field spec's `lines.baseline.weight` can read and
 * write a nested SheetInput without any per-field wiring.
 */
type Nested = Record<string, unknown>;

export function setAt(root: Nested, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;

  let node = root;

  for (const key of keys) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Nested;
  }

  node[last] = value;
}

/** Removes a field so the config default applies again. */
export function clearAt(root: Nested, path: string): void {
  const keys = path.split('.');
  const last = keys.pop()!;

  let node = root;

  for (const key of keys) {
    if (typeof node[key] !== 'object' || node[key] === null) return;
    node = node[key] as Nested;
  }

  delete node[last];
}
