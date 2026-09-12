import { OUTREACH_AI_SCENARIO_CATALOG } from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-scenario-catalog';
import {
  runOutreachAiLiveScenario,
  runOutreachAiLiveSuite,
} from 'src/engine/core-modules/outreach-command/prompts/fixtures/run-outreach-ai-live-eval';

/**
 * Live DeepSeek-first eval for outreach AI scenarios.
 *
 *   OUTREACH_AI_LIVE_LLM=1 \
 *   OUTREACH_AI_LIVE_MODEL=openrouter/deepseek/deepseek-v4-flash-0731 \
 *   npx jest outreach-ai-scenario.live.spec --config=jest.config.mjs --runInBand
 *
 * Optional: OUTREACH_AI_LIVE_ESCALATE=1 to climb the model ladder on failures.
 * Optional: OUTREACH_AI_LIVE_PRIORITY=must|pass|low|all (default must)
 * Optional: OUTREACH_AI_LIVE_IDS=id1,id2 to run a subset
 */

const LIVE = process.env.OUTREACH_AI_LIVE_LLM === '1';
const describeLive = LIVE ? describe : describe.skip;

const resolvePriorities = (): Array<'must' | 'pass' | 'low'> => {
  const raw = process.env.OUTREACH_AI_LIVE_PRIORITY?.trim() || 'must';

  if (raw === 'all') {
    return ['must', 'pass', 'low'];
  }

  if (raw === 'pass' || raw === 'low' || raw === 'must') {
    return [raw];
  }

  return ['must'];
};

describeLive('outreach-ai-scenario live LLM', () => {
  jest.setTimeout(900_000);

  it('passes catalog scenarios on the configured model', async () => {
    const priorities = resolvePriorities();
    const results = await runOutreachAiLiveSuite({ priorities });
    const failures = results.filter((result) => !result.passed);

    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          failures.map((failure) => ({
            id: failure.scenarioId,
            modelId: failure.modelId,
            diffs: failure.diffs,
            actual: failure.actual,
          })),
          null,
          2,
        ),
      );
    }

    expect(failures).toEqual([]);
  }, 900_000);

  it('can run a single extract scenario for debugging', async () => {
    if (process.env.OUTREACH_AI_LIVE_SINGLE !== '1') {
      return;
    }

    const scenario = OUTREACH_AI_SCENARIO_CATALOG.find(
      (item) => item.id === 'extract-vague-time-pulkit',
    );

    expect(scenario).toBeDefined();

    const result = await runOutreachAiLiveScenario({ scenario: scenario! });

    expect(result.passed).toBe(true);
  });
});
