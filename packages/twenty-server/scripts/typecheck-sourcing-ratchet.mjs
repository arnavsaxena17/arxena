#!/usr/bin/env node
/**
 * Typecheck ratchet for the sourcing modules.
 *
 * `nest` builds this package with SWC and `typeCheck: false`, so no type error can
 * block a build or a boot. The checker is a separate pipeline that nothing depends
 * on, and it currently reports ~1,000 errors package-wide. A blanket gate would be
 * unusable on day one, so this one gates only the modules the sourcing refactor
 * touches, and only against getting *worse*.
 *
 * Counting errors alone is gameable: `as any`, `@ts-ignore` and a widened index
 * signature all lower the error count while making the checker less useful. So it
 * tracks three numbers per module and fails if any of them rises.
 *
 *   node scripts/typecheck-sourcing-ratchet.mjs            # check
 *   node scripts/typecheck-sourcing-ratchet.mjs --update    # accept current state
 *
 * Exit codes: 0 within baseline, 1 grew, 2 the checker itself failed.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(PACKAGE_ROOT, 'typecheck-sourcing.baseline.json');

const MODULES = [
  'src/engine/core-modules/candidate-sourcing',
  'src/engine/core-modules/candidate-search',
  'src/engine/core-modules/org-chart',
  'src/engine/core-modules/linkedin-search',
  'src/engine/core-modules/arxena-tools',
];

// The three numbers that may only go down.
const METRICS = ['errors', 'suppressions', 'explicitAny'];

const METRIC_LABEL = {
  errors: 'type errors',
  suppressions: '@ts-ignore/@ts-expect-error',
  explicitAny: ': any / as any',
};

// Paths come back relative to the tsconfig. Strip a package prefix if the checker
// was invoked from the workspace root, so both spellings agree.
const ERROR_LINE = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const PACKAGE_PREFIX = 'packages/twenty-server/';
const SUPPRESSION = /@ts-(?:ignore|expect-error|nocheck)\b/g;
const EXPLICIT_ANY = /(?::\s*any\b|\bas\s+any\b|<\s*any\s*>)/g;

const normalizePath = (rawPath) => {
  const normalized = rawPath
    .trim()
    .replace(/^\.\//, '')
    .split('\\')
    .join('/');
  const prefixAt = normalized.indexOf(PACKAGE_PREFIX);

  return prefixAt >= 0
    ? normalized.slice(prefixAt + PACKAGE_PREFIX.length)
    : normalized;
};

const moduleForPath = (relativePath) =>
  MODULES.find(
    (modulePath) =>
      relativePath === modulePath || relativePath.startsWith(`${modulePath}/`),
  ) ?? null;

const emptyMetrics = () =>
  Object.fromEntries(
    MODULES.map((modulePath) => [
      modulePath,
      { errors: 0, suppressions: 0, explicitAny: 0 },
    ]),
  );

const runChecker = () => {
  // --noEmit and --incremental false are load-bearing. Without them the checker
  // writes JS and a .tsbuildinfo into dist/, and the stale build info then makes
  // later runs ignore compilerOptions changes such as `lib`.
  const result = spawnSync(
    'npx',
    ['tsgo', '-p', 'tsconfig.json', '--noEmit', '--incremental', 'false'],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    },
  );

  if (result.error) {
    console.error(`Could not run tsgo: ${result.error.message}`);
    process.exit(2);
  }

  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  };
};

const collectErrors = (output, metrics) => {
  const messages = [];

  for (const line of output.split('\n')) {
    const match = ERROR_LINE.exec(line.trim());

    if (!match) {
      continue;
    }

    const [, rawPath, lineNumber, column, code, message] = match;
    const relativePath = normalizePath(rawPath);
    const modulePath = moduleForPath(relativePath);

    if (modulePath === null) {
      continue;
    }

    metrics[modulePath].errors += 1;
    messages.push({
      modulePath,
      text: `${relativePath}(${lineNumber},${column}) ${code}: ${message}`,
    });
  }

  return messages;
};

// Counts what a lazy fix looks like. Approximate by design: it counts text
// occurrences, not resolved types, which is enough to stop a number from being
// laundered.
const collectSourceDebt = (metrics) => {
  for (const modulePath of MODULES) {
    let entries;

    try {
      entries = readdirSync(join(PACKAGE_ROOT, modulePath), {
        recursive: true,
        withFileTypes: true,
      });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) {
        continue;
      }

      const filePath = join(
        entry.parentPath ?? entry.path ?? modulePath,
        entry.name,
      );

      let source;

      try {
        source = readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }

      metrics[modulePath].suppressions +=
        source.match(SUPPRESSION)?.length ?? 0;
      metrics[modulePath].explicitAny += source.match(EXPLICIT_ANY)?.length ?? 0;
    }
  }
};

const totals = (metrics) =>
  Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      MODULES.reduce((sum, modulePath) => sum + metrics[modulePath][metric], 0),
    ]),
  );

const readBaseline = () => {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
};

const writeBaseline = (metrics) => {
  const baseline = {
    // Regenerate with --update. Lower these numbers as debt is paid off; never
    // raise them to make a failing check pass.
    note: 'Sourcing-module type debt. A ratchet, not a target. Only decreases.',
    metrics,
    totals: totals(metrics),
  };

  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);

  return baseline;
};

const reportGrowth = (metrics, baseline, messages) => {
  for (const modulePath of MODULES) {
    const grown = METRICS.filter(
      (metric) =>
        metrics[modulePath][metric] >
        (baseline.metrics[modulePath]?.[metric] ?? 0),
    );

    for (const metric of grown) {
      const before = baseline.metrics[modulePath]?.[metric] ?? 0;
      const after = metrics[modulePath][metric];

      console.error(
        `\n${modulePath} · ${METRIC_LABEL[metric]}: ${before} -> ${after} (+${after - before})`,
      );

      if (metric !== 'errors') {
        continue;
      }

      const sample = messages
        .filter((entry) => entry.modulePath === modulePath)
        .slice(0, 25);

      for (const entry of sample) {
        console.error(`  ${entry.text}`);
      }

      if (after > sample.length) {
        console.error(`  ... and ${after - sample.length} more in this module`);
      }
    }
  }
};

const main = () => {
  const shouldUpdate = process.argv.includes('--update');
  const { output, status } = runChecker();
  const metrics = emptyMetrics();
  const messages = collectErrors(output, metrics);

  // A non-zero exit is expected: the package has errors outside these modules too.
  // A non-zero exit with no error text at all means the checker never got going.
  if (status !== 0 && !output.includes('error TS')) {
    console.error('tsgo produced no parseable errors but did not exit cleanly:');
    console.error(output.split('\n').slice(-20).join('\n'));
    process.exit(2);
  }

  collectSourceDebt(metrics);

  if (shouldUpdate) {
    const baseline = writeBaseline(metrics);

    console.log('Baseline written:');
    console.log(`  ${baseline.totals.errors} type errors`);
    console.log(`  ${baseline.totals.suppressions} suppressions`);
    console.log(`  ${baseline.totals.explicitAny} explicit any`);

    return;
  }

  const baseline = readBaseline();

  if (baseline === null) {
    console.error(`No baseline at ${BASELINE_PATH}. Run with --update to create it.`);
    process.exit(2);
  }

  const current = totals(metrics);
  const grownMetrics = METRICS.filter(
    (metric) => current[metric] > (baseline.totals?.[metric] ?? 0),
  );

  if (grownMetrics.length > 0) {
    const summary = grownMetrics
      .map(
        (metric) =>
          `${METRIC_LABEL[metric]} ${baseline.totals?.[metric] ?? 0} -> ${current[metric]}`,
      )
      .join(', ');

    console.error(`Type debt grew: ${summary}. Fix what you added — do not raise the baseline.`);
    reportGrowth(metrics, baseline, messages);
    process.exit(1);
  }

  const paidOff = baseline.totals.errors - current.errors;
  const suffix =
    paidOff > 0 ? ` (-${paidOff}, lower the baseline with --update)` : '';

  console.log(
    `Type debt within baseline: ${current.errors}/${baseline.totals.errors} errors${suffix}, ` +
      `${current.suppressions}/${baseline.totals.suppressions} suppressions, ` +
      `${current.explicitAny}/${baseline.totals.explicitAny} explicit any`,
  );
};

main();
