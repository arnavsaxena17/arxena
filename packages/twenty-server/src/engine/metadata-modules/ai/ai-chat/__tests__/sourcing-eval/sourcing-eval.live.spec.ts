// Behaviour eval of the sourcing skill. The agent gets the real skill text and
// a real model. Tools are stubs by default. With SOURCING_EVAL_LIVE_BACKEND=1,
// allowlisted tools hit a running twenty-server under hard caps (see README).
// Skipped unless SOURCING_LIVE_EVAL=1.
//
//   SOURCING_LIVE_EVAL=1 OPENROUTER_API_KEY=... \
//     npx jest sourcing-eval --config=jest.config.mjs
//   SOURCING_EVAL_ONLY=cbo-marketplace-named-companies   # one scenario
//   SOURCING_EVAL_REPEAT=3                               # runs per scenario
//   SOURCING_EVAL_JUDGE=1                                # model-judged assertions
//   SOURCING_EVAL_MODEL=deepseek/deepseek-v4-flash-0731  # default: Ask AI's model
//   SOURCING_EVAL_OUT=tmp/sourcing-eval                  # where traces are written
//   SOURCING_EVAL_MAX_STEPS=50                           # default 30
//   SOURCING_EVAL_TIMEOUT_MS=600000                      # default 240000
//   SOURCING_EVAL_LIVE_BACKEND=1                         # real tools via MCP
//   SOURCING_EVAL_BASE_URL=http://localhost:3000
//   SOURCING_EVAL_API_TOKEN=... SOURCING_EVAL_PROJECT_ID=...
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  gradeDeterministic,
  judgeWithModel,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/grade';
import {
  LIVE_BACKEND,
  readLiveToolConfig,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/live-tools';
import {
  describePath,
  renderPath,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/path';
import {
  buildQualityReport,
  renderQualityReport,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/quality';
import {
  runScenario,
  TIMEOUT_MS,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/run-scenario';
import {
  adHocScenario,
  loadScenarios,
  type SourcingScenario,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/scenario';

const SCENARIOS_DIRECTORY = join(__dirname, 'scenarios');
const LIVE = process.env.SOURCING_LIVE_EVAL === '1';
const OUTPUT_DIRECTORY =
  process.env.SOURCING_EVAL_OUT ?? join(process.cwd(), 'tmp', 'sourcing-eval');
const REPEAT = Number(process.env.SOURCING_EVAL_REPEAT ?? 1);
const ONLY = process.env.SOURCING_EVAL_ONLY;
// Jest must outlive generateText's AbortSignal.timeout.
const JEST_TIMEOUT_MS = REPEAT * (TIMEOUT_MS + 60_000);

describe('sourcing eval scenarios', () => {
  const scenarios = loadScenarios(SCENARIOS_DIRECTORY);

  it('should load every scenario with a request and expectations', () => {
    expect(scenarios.length).toBeGreaterThan(0);

    for (const scenario of scenarios) {
      expect(scenario.id).toMatch(/^[a-z0-9-]+$/);
      expect(scenario.userSays).not.toBe('');
      expect(scenario.setup).not.toBe('');
      expect(scenario.expect.must_call.length).toBeGreaterThan(0);
      expect(scenario.expect.plan_assertions.length).toBeGreaterThan(0);
    }
  });

  it('should give every scenario a unique id', () => {
    const ids = scenarios.map((scenario) => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

const PROMPT = process.env.SOURCING_EVAL_PROMPT;

// One prompt typed by hand: which skills load, which track, which sources.
//   SOURCING_LIVE_EVAL=1 SOURCING_EVAL_PROMPT='Give me all sales reps in pharma ...' \
//     npx jest sourcing-eval --config=jest.config.mjs
// No space after =. Writes <out>/adhoc.path.md and <out>/adhoc.runN.json.
// Optional: SOURCING_EVAL_SETUP, SOURCING_EVAL_REPLIES.
const describeAdHoc = LIVE && PROMPT !== undefined ? describe : describe.skip;

describeAdHoc('sourcing path for one prompt', () => {
  // Global fake timers stall OpenRouter fetch + AbortSignal.timeout.
  beforeAll(() => {
    jest.useRealTimers();
  });

  it(
    'should write the path the prompt takes',
    async () => {
      // eslint-disable-next-line no-console
      console.log('[sourcing-eval] ad-hoc prompt:', PROMPT);
      mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      const scenario = adHocScenario(
        PROMPT ?? '',
        process.env.SOURCING_EVAL_SETUP,
        process.env.SOURCING_EVAL_REPLIES,
      );
      const sections: string[] = [];
      let firstError: string | undefined;

      const liveConfig = LIVE_BACKEND ? readLiveToolConfig() : null;
      let qualityMarkdown = '';

      for (let run = 1; run <= REPEAT; run++) {
        console.log('run', run);
        const trace = await runScenario(scenario);
        const report = describePath(trace);
        const quality =
          liveConfig === null
            ? null
            : await buildQualityReport(liveConfig, trace.calls);

        writeFileSync(
          join(OUTPUT_DIRECTORY, `adhoc.run${run}.json`),
          JSON.stringify({ trace, report, quality }, null, 2),
        );
        sections.push(
          `<!-- run ${run} -->\n${renderPath(scenario.userSays, report)}`,
        );
        firstError ??= trace.error;

        if (quality !== null) {
          qualityMarkdown = renderQualityReport(quality);
          writeFileSync(
            join(OUTPUT_DIRECTORY, `adhoc.quality.md`),
            qualityMarkdown,
          );
        }

        // eslint-disable-next-line no-console
        console.log(
          `\n[sourcing-eval] PATH (run ${run} of ${REPEAT}, ${trace.steps} steps)\n${renderPath(scenario.userSays, report)}${
            qualityMarkdown ? `\n${qualityMarkdown}` : ''
          }${trace.error ? `\nERROR: ${trace.error}` : ''}\nFinal message:\n${trace.finalText.slice(0, 1500)}`,
        );
      }

      writeFileSync(
        join(OUTPUT_DIRECTORY, 'adhoc.path.md'),
        sections.join('\n'),
      );
      // eslint-disable-next-line no-console
      console.log(`[sourcing-eval] saved to ${OUTPUT_DIRECTORY}/adhoc.path.md`);
      if (LIVE_BACKEND) {
        // eslint-disable-next-line no-console
        console.log(
          `[sourcing-eval] quality saved to ${OUTPUT_DIRECTORY}/adhoc.quality.md`,
        );
      }

      expect(firstError).toBeUndefined();
    },
    JEST_TIMEOUT_MS,
  );
});

const describeLive = LIVE && PROMPT === undefined ? describe : describe.skip;

describeLive('sourcing eval (live)', () => {
  // Global fake timers stall OpenRouter fetch + AbortSignal.timeout.
  beforeAll(() => {
    jest.useRealTimers();
  });

  console.log('PROMPT', PROMPT);
  console.log('SCENARIOS_DIRECTORY', SCENARIOS_DIRECTORY);
  console.log('ONLY', ONLY);
  console.log('REPEAT', REPEAT);
  // console.log('SOURCING_EVAL_JUDGE', SOURCING_EVAL_JUDGE);
  // console.log('SOURCING_EVAL_MODEL', SOURCING_EVAL_MODEL);
  // console.log('SOURCING_EVAL_OUT', SOURCING_EVAL_OUT);
  // console.log('SOURCING_EVAL_PROMPT', SOURCING_EVAL_PROMPT);
  // console.log('SOURCING_EVAL_SETUP', SOURCING_EVAL_SETUP);
  // console.log('SOURCING_EVAL_REPLIES', SOURCING_EVAL_REPLIES);
  const scenarios = loadScenarios(SCENARIOS_DIRECTORY).filter(
    (scenario) => ONLY === undefined || scenario.id === ONLY,
  );

  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s',
    async (_id: string, scenario: SourcingScenario) => {
      console.log('REPEAT', REPEAT);
      mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      console.log('OUTPUT_DIRECTORY', OUTPUT_DIRECTORY);
      const failures: string[] = [];

      for (let run = 1; run <= REPEAT; run++) {
        console.log('run', run);
        const trace = await runScenario(scenario);
        const checks = gradeDeterministic(scenario, trace);
        const verdicts =
          process.env.SOURCING_EVAL_JUDGE === '1'
            ? await judgeWithModel(scenario, trace)
            : [];

        writeFileSync(
          join(OUTPUT_DIRECTORY, `${scenario.id}.run${run}.json`),
          JSON.stringify({ trace, checks, verdicts }, null, 2),
        );

        // eslint-disable-next-line no-console
        console.log(
          `\n[sourcing-eval] ${scenario.id} run ${run}: ${trace.steps} steps\n${checks
            .map(
              (check) =>
                `  ${check.passed ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` (${check.detail})` : ''}`,
            )
            .join(
              '\n',
            )}\n${renderPath(scenario.userSays, describePath(trace))}${
            verdicts.length > 0
              ? `\nJudge:\n${verdicts.map((verdict) => `  ${verdict.verdict.toUpperCase()} ${verdict.assertion} - ${verdict.evidence}`).join('\n')}`
              : ''
          }`,
        );

        failures.push(
          ...checks
            .filter((check) => !check.passed)
            .map(
              (check) =>
                `run ${run}: ${check.name}${check.detail ? ` (${check.detail})` : ''}`,
            ),
        );
      }

      expect(failures).toEqual([]);
    },
    JEST_TIMEOUT_MS,
  );
});
