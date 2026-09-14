/**
 * Resolves a raw input against the defaults and prints the result, so you can
 * see exactly what a partial config becomes.
 *
 *   npm run resolve -- '{"metrics":{"capHeight":96}}'
 */
import { ConfigError, resolveConfig } from '../src/config/index.js';

const raw = process.argv[2] ?? '{}';

let input: unknown;

try {
  input = JSON.parse(raw);
} catch {
  console.error(`Could not parse that as JSON:\n  ${raw}`);
  process.exit(1);
}

try {
  console.log(JSON.stringify(resolveConfig(input as Record<string, unknown>), null, 2));
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }

  throw error;
}
