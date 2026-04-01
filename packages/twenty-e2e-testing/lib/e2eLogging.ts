import chalk from 'chalk';

/**
 * Colored step logging for Playwright specs. Import `logStage` / `StageTracker` from this module
 * for generic `[e2e]` lines, or call `createE2eSuiteLogger('my-suite')` for a custom grep-friendly tag.
 */
export const createE2eSuiteLogger = (tag: string) => {
  const bracket = () => chalk.bold.cyan(`[${tag}]`);

  const logStage = (stage: string, detail?: Record<string, unknown>): void => {
    const line =
      `${bracket()} ${chalk.white(stage)}` +
      (detail !== undefined ? chalk.blackBright(` ${JSON.stringify(detail)}`) : '');
    // eslint-disable-next-line no-console
    console.log(line);
  };

  const logStageFailure = (
    stage: string,
    error: unknown,
    detail?: Record<string, unknown>,
  ): void => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const header = `${chalk.bold.red(`[${tag}]`)} ${chalk.redBright('FAIL:')} ${chalk.yellow(stage)}`;
    // eslint-disable-next-line no-console
    console.log(header);
    // Playwright expect() puts ANSI-colored diffs in message; JSON.stringify turns them into \u001b escapes.
    // eslint-disable-next-line no-console
    console.log(message);
    if (detail !== undefined && Object.keys(detail).length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        chalk.dim('context:'),
        chalk.black(JSON.stringify(detail, null, 2)),
      );
    }
    if (stack !== undefined) {
      // eslint-disable-next-line no-console
      console.log(chalk.dim(stack));
    }
  };

  /**
   * Step progress for specs. Runtime cannot infer how many `log()` calls a test will make; options:
   *
   * - `new StageTracker()` — no total: lines show `#1`, `#2`, … (remaining unknown).
   * - `new StageTracker(10)` — fixed total: `3/10`, remaining = 7.
   * - `new StageTracker(['a','b'] as const)` — total = `length`; call `next()` / `next(detail)` so count and labels come from one array.
   */
  class StageTracker {
    private current = 0;

    private readonly total: number | undefined;

    private readonly stages: readonly string[] | undefined;

    constructor();
    constructor(total: number);
    constructor(stages: readonly string[]);
    constructor(totalOrStages?: number | readonly string[]) {
      if (totalOrStages === undefined) {
        this.total = undefined;
        this.stages = undefined;
      } else if (typeof totalOrStages === 'number') {
        this.total = totalOrStages;
        this.stages = undefined;
      } else {
        this.total = totalOrStages.length;
        this.stages = totalOrStages;
      }
    }

    private isPlanMode(): boolean {
      return this.stages !== undefined;
    }

    private prefix(): string {
      if (this.total === undefined) {
        return chalk.dim(`#${this.current}`);
      }
      return chalk.dim(`${this.current}/${this.total}`);
    }

    private failPrefixForAt(at: number): string {
      if (this.total === undefined) {
        return chalk.dim(`#${at}`);
      }
      return chalk.dim(`${at}/${this.total}`);
    }

    /**
     * Log a step with an explicit label. Not used in plan mode (array constructor); use `next()` there.
     */
    log(stage: string, detail?: Record<string, unknown>): void {
      if (this.isPlanMode()) {
        throw new Error(
          'StageTracker was built with a stage list: use next() or next(detail) instead of log(stage).',
        );
      }
      this.current = Math.min(
        this.current + 1,
        this.total ?? Number.MAX_SAFE_INTEGER,
      );
      const line =
        `${bracket()} ${this.prefix()} ${chalk.white(stage)}` +
        (detail !== undefined ? chalk.dim(` ${JSON.stringify(detail)}`) : '');
      // eslint-disable-next-line no-console
      console.log(line);
    }

    /**
     * Plan mode only: log the next label from the constructor array, with optional detail JSON.
     */
    next(detail?: Record<string, unknown>): void {
      if (!this.isPlanMode() || !this.stages) {
        throw new Error(
          'next() is only for StageTracker built with an array of stage names; otherwise use log(stage).',
        );
      }
      if (this.current >= this.stages.length) {
        throw new Error(
          `StageTracker: more next() calls than stages (${this.stages.length}).`,
        );
      }
      const stage = this.stages[this.current];
      this.current += 1;
      const line =
        `${bracket()} ${this.prefix()} ${chalk.white(stage)}` +
        (detail !== undefined ? chalk.dim(` ${JSON.stringify(detail)}`) : '');
      // eslint-disable-next-line no-console
      console.log(line);
    }

    fail(
      stage: string,
      error: unknown,
      detail?: Record<string, unknown>,
    ): void {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const at = Math.max(1, this.current);
      const failPrefix = this.failPrefixForAt(at);
      const remainingHint =
        this.remaining === undefined
          ? ''
          : chalk.dim(` (${this.remaining} remaining)`);
      const header =
        `${chalk.bold.red(`[${tag}]`)} ${failPrefix} ` +
        `${chalk.redBright('FAIL:')} ${chalk.yellow(stage)}` +
        remainingHint;
      // eslint-disable-next-line no-console
      console.log(header);
      // eslint-disable-next-line no-console
      console.log(message);
      if (detail !== undefined && Object.keys(detail).length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          chalk.dim('context:'),
          chalk.black(JSON.stringify(detail, null, 2)),
        );
      }
      if (stack !== undefined) {
        // eslint-disable-next-line no-console
        console.log(chalk.dim(stack));
      }
    }

    get remaining(): number | undefined {
      if (this.total === undefined) {
        return undefined;
      }
      return this.total - this.current;
    }

    reset(): void {
      this.current = 0;
    }
  }

  return { logStage, logStageFailure, StageTracker };
};

export type E2eSuiteLogger = ReturnType<typeof createE2eSuiteLogger>;

const defaultSuite = createE2eSuiteLogger('e2e');

/** Default `[e2e]` suite — use in any Playwright spec. */
export const logStage = defaultSuite.logStage;

/** Default `[e2e]` failure line. */
export const logStageFailure = defaultSuite.logStageFailure;

/** Default `[e2e]` stage tracker (N/total). */
export const StageTracker = defaultSuite.StageTracker;
