export interface ConfigIssue {
  /** Dotted path of the offending field, e.g. `metrics.xHeight`. */
  path: string;
  message: string;
}

/**
 * Every problem with the input at once. One bad field should not hide the
 * other three — and a form, when there is one, wants them all to render
 * against their inputs.
 */
export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    const lines = issues.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n');

    super(`Invalid sheet config:\n${lines}`);

    this.name = 'ConfigError';
    this.issues = issues;
  }
}
