// Live quality eval of the AI filter node against labelled golden sets.
//
// Runs the SHIPPED seeded prompts (read from the workflow graph templates)
// through WorkflowAiFilteringService.processAndBuildResult, the same code the
// queue job runs, with a real model. Skipped unless AI_FILTER_LIVE_EVAL=1.
//
//   AI_FILTER_LIVE_EVAL=1 npx jest ai-filter-eval --config=jest.config.mjs
//   AI_FILTER_EVAL_MODELS=gpt4omini,gpt4o,typesafe-ai/jev   # compare models
//   (default: each seeded step's own model)
//
// The golden sets are synthetic and labelled against the contexts in campaign-context.ts;
// extend them with real approved/rejected records from the campaign.
import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';
import { JevEvaluationService } from 'src/engine/metadata-modules/ai/ai-evaluation/services/jev-evaluation.service';
import { OUTREACH_WORKFLOW_GRAPH_TEMPLATES } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

import companiesGolden from './companies.golden.json';
import peopleGolden from './people.golden.json';
import {
  GOLDEN_COMPANY_CONTEXT,
  GOLDEN_PEOPLE_CONTEXT,
} from './campaign-context';

type Golden = { id: string; expectedKeep: boolean } & Record<string, unknown>;

const LIVE = process.env.AI_FILTER_LIVE_EVAL === '1';
const MODELS = (process.env.AI_FILTER_EVAL_MODELS ?? 'seeded')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const MIN_ACCURACY = 0.85;
const MIN_PRECISION = 0.85;

const loadSeededFilter = (graphName: string) => {
  const graph = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
    (template) => template.name === graphName,
  );
  const step = (
    graph?.steps as Array<{
      type: string;
      settings: { input: Record<string, unknown> };
    }>
  ).find((candidate) => candidate.type === 'AI_FILTERING');

  if (!step) {
    throw new Error(`No AI_FILTERING step in ${graphName}`);
  }

  return step.settings.input as {
    name: string;
    prompt: string;
    selectedMetadataFields: string[];
    fields: Array<{ name: string; type: string }>;
    keepField: string;
    subject: 'person' | 'company';
    batchSize: number;
    concurrency: number;
    selectedModel: string;
  };
};

const buildService = () => {
  const jev = new JevEvaluationService({
    get: (key: string) => process.env[key],
  } as never);
  const engine = new AiFilterEngineService(jev);

  return new WorkflowAiFilteringService(
    engine,
    {} as never,
    { add: jest.fn() } as never,
    { resolveForWorkspace: jest.fn() } as never,
  );
};

const evaluate = async ({
  graphName,
  golden,
  model,
}: {
  graphName: string;
  golden: Golden[];
  model: string;
}) => {
  const seeded = loadSeededFilter(graphName);
  const startedAt = Date.now();
  const result = await buildService().processAndBuildResult({
    candidates: golden.map(
      ({ expectedKeep: _expected, why: _why, ...record }) => record,
    ),
    filter: {
      ...seeded,
      selectedModel: model === 'seeded' ? seeded.selectedModel : model,
    },
    workspaceContext:
      seeded.subject === 'company'
        ? GOLDEN_COMPANY_CONTEXT
        : GOLDEN_PEOPLE_CONTEXT,
  });
  const keptIds = new Set(
    (result.kept ?? []).map((record) => String(record.id)),
  );
  const reasonById = new Map(
    (result.rejected ?? []).map((record) => [String(record.id), record.reason]),
  );
  const failedIds = new Set(
    (result.failed ?? []).map((record) => String(record.id)),
  );
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  const misses: string[] = [];

  for (const record of golden) {
    const kept = keptIds.has(record.id);

    if (failedIds.has(record.id)) {
      misses.push(`${record.id} FAILED`);
    } else if (kept && record.expectedKeep) {
      truePositive += 1;
    } else if (kept && !record.expectedKeep) {
      falsePositive += 1;
      misses.push(
        `${record.id} ${String(record.name)}: kept, expected reject (${String(record.why)})`,
      );
    } else if (!kept && record.expectedKeep) {
      falseNegative += 1;
      misses.push(
        `${record.id} ${String(record.name)}: rejected, expected keep (${String(record.why)}) | model: ${reasonById.get(record.id)}`,
      );
    } else {
      trueNegative += 1;
    }
  }

  const answered = golden.length - failedIds.size;

  return {
    graphName,
    model,
    total: golden.length,
    accuracy: (truePositive + trueNegative) / golden.length,
    precision: truePositive / Math.max(1, truePositive + falsePositive),
    recall: truePositive / Math.max(1, truePositive + falseNegative),
    failed: failedIds.size,
    answered,
    engine: result.stats?.engine,
    calls: result.stats?.calls,
    seconds: (Date.now() - startedAt) / 1000,
    misses,
  };
};

(LIVE ? describe : describe.skip)(
  'AI filter live eval (seeded prompts)',
  () => {
    jest.setTimeout(180_000);

    it.each(
      MODELS.flatMap(
        (model) =>
          [
            ['Find companies', companiesGolden, model],
            ['Find people by company', peopleGolden, model],
          ] as Array<[string, Golden[], string]>,
      ),
    )('%s on %s', async (graphName, golden, model) => {
      const report = await evaluate({ graphName, golden, model });

      // eslint-disable-next-line no-console
      console.log(
        `EVAL ${graphName} | model=${model} engine=${report.engine} | n=${report.total} ` +
          `accuracy=${report.accuracy.toFixed(2)} precision=${report.precision.toFixed(2)} ` +
          `recall=${report.recall.toFixed(2)} failed=${report.failed} calls=${report.calls} ` +
          `\n  ${report.misses.join('\n  ') || 'no misses'}`,
      );

      expect(report.failed).toBe(0);
      expect(report.accuracy).toBeGreaterThanOrEqual(MIN_ACCURACY);
      expect(report.precision).toBeGreaterThanOrEqual(MIN_PRECISION);
    });
  },
);
