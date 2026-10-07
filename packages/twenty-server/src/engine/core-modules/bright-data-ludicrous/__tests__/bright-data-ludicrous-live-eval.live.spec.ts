import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject } from 'ai';
import { z } from 'zod';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousPlan,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { passesRubricHardConstraints } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-relevance.util';
import { BrightDataLudicrousExecutorService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-executor.service';
import { BrightDataLudicrousPlannerService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-planner.service';
import { summarizeBrightDataLudicrousPlan } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-search.service';

// Live eval: real LLM planner + real Bright Data. Costs money, so it only runs
// with RUN_BRIGHT_DATA_LIVE_EVAL=1. Relevance judging uses the planner rubric
// (Jev needs the full Nest app); ground truth is hand-written per case.

const ENV_PATH = join(__dirname, '../../../../../.env');
const readEnv = (key: string): string | undefined => {
  try {
    const line = readFileSync(ENV_PATH, 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith(`${key}=`));

    return line
      ?.slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
};

type EvalCase = {
  id: string;
  entity: BrightDataLudicrousEntity;
  raw: string;
  // <=200 chars natural-language version for the instant baseline
  instantQuery: string;
  truth: (data: Record<string, unknown>) => boolean;
  maxBudgetUsd: number;
};

const str = (data: Record<string, unknown>, key: string): string =>
  typeof data[key] === 'string' ? (data[key] as string) : '';

const CASES: EvalCase[] = [
  {
    id: 'people-eng-leaders-india',
    entity: 'people',
    raw: 'Engineering leadership (head of engineering, VP engineering, director of engineering, CTO) in India',
    instantQuery:
      'Head of Engineering, VP Engineering, Director of Engineering or CTO in India',
    truth: (d) =>
      str(d, 'country_code').toUpperCase() === 'IN' &&
      /(head of eng|vp.*eng|vice president.*eng|director.*eng|engineering director|\bcto\b|chief technology)/i.test(
        str(d, 'current_title'),
      ),
    maxBudgetUsd: 0.3,
  },
  {
    id: 'people-marketing-bengaluru',
    entity: 'people',
    raw: 'Marketing and growth leaders (head of marketing, head of growth, VP marketing, CMO) based in Bengaluru',
    instantQuery:
      'Head of Marketing, Head of Growth, VP Marketing or CMO based in Bengaluru',
    truth: (d) =>
      /bengaluru|bangalore/i.test(str(d, 'location') + str(d, 'city')) &&
      /(head of (growth|marketing)|vp.*(growth|marketing)|vice president.*(growth|marketing)|chief marketing|\bcmo\b|director.*(growth|marketing)|(growth|marketing) director)/i.test(
        str(d, 'current_title'),
      ),
    maxBudgetUsd: 0.3,
  },
  {
    id: 'people-boolean-sales-us',
    entity: 'people',
    raw: '("VP Sales" OR "Head of Sales" OR "Chief Revenue Officer") NOT assistant, United States',
    instantQuery:
      'VP Sales, Head of Sales or Chief Revenue Officer in the United States',
    truth: (d) =>
      str(d, 'country_code').toUpperCase() === 'US' &&
      /(vp.*sales|vice president.*sales|head of sales|chief revenue|\bcro\b)/i.test(
        str(d, 'current_title'),
      ) &&
      !/assistant/i.test(str(d, 'current_title')),
    maxBudgetUsd: 0.3,
  },
  {
    id: 'company-saas-india-51-500',
    entity: 'company',
    raw: 'B2B SaaS and software companies headquartered in India with 51 to 500 employees',
    instantQuery:
      'Software or SaaS companies headquartered in India with 51 to 500 employees',
    truth: (d) =>
      str(d, 'headquarters_country_code').toUpperCase() === 'IN' &&
      /software|it services|technology|internet/i.test(str(d, 'industry')) &&
      [51, 201].includes(d.company_size_from as number),
    maxBudgetUsd: 0.3,
  },
  {
    id: 'company-fintech-us-uk-11-200',
    entity: 'company',
    raw: 'Fintech and financial software companies in the US or UK with 11 to 200 employees',
    instantQuery:
      'Fintech or financial software companies in the US or UK with 11 to 200 employees',
    truth: (d) =>
      ['US', 'GB'].includes(
        str(d, 'headquarters_country_code').toUpperCase(),
      ) &&
      /financial|software|banking|payment|insurance|investment|technology/i.test(
        str(d, 'industry'),
      ) &&
      [11, 51].includes(d.company_size_from as number),
    maxBudgetUsd: 0.3,
  },
];

const describeLive =
  process.env.RUN_BRIGHT_DATA_LIVE_EVAL === '1' ? describe : describe.skip;

describeLive('bright data ludicrous live eval', () => {
  jest.setTimeout(600_000);

  it('plans, estimates, executes and compares against instant', async () => {
    process.env.BRIGHT_DATA_API_KEY = readEnv('BRIGHT_DATA_API_KEY');
    const openai = createOpenAI({ apiKey: readEnv('OPENAI_API_KEY') });
    const modelId = process.env.EVAL_PLANNER_MODEL ?? 'gpt-4o-mini';
    const search = new BrightDataBusinessSearchService();
    const ledger = { records: 0 };
    const plans = new Map<string, BrightDataLudicrousPlan>();

    const billing = {
      validateCreditsOrThrow: async () => undefined,
      billRecords: async ({ recordCount }: { recordCount: number }) => {
        ledger.records += recordCount;

        return { chargedUsd: recordCount * 0.002 };
      },
    };
    const store = {
      save: async (plan: BrightDataLudicrousPlan) => {
        plans.set(plan.planId, plan);
      },
    };
    // EVAL_JUDGE_PROVIDER=openrouter judges with typesafe/jev-router
    const judgeModel =
      process.env.EVAL_JUDGE_PROVIDER === 'openrouter'
        ? createOpenAICompatible({
            name: 'openrouter',
            apiKey: readEnv('OPENROUTER_API_KEY'),
            baseURL: 'https://openrouter.ai/api/v1',
            supportsStructuredOutputs: true,
          })(process.env.EVAL_JUDGE_MODEL ?? 'typesafe/jev-router')
        : openai(process.env.EVAL_JUDGE_MODEL ?? 'gpt-4o-mini');
    const judge = {
      // Stand-in for Jev: hard constraints are free, wording goes to an LLM
      judge: async ({
        entity,
        documents,
        rubric,
        relevanceCriteria,
      }: {
        entity: BrightDataLudicrousEntity;
        documents: Array<{ brightId: string; data: Record<string, unknown> }>;
        rubric: BrightDataLudicrousPlan['rubric'];
        relevanceCriteria: string;
      }) => {
        const plausible = documents.filter((document) =>
          passesRubricHardConstraints({ entity, data: document.data, rubric }),
        );
        const answers = new Map<string, boolean>();

        if (plausible.length > 0) {
          const { object } = await generateObject({
            model: judgeModel,
            schema: z.object({
              verdicts: z.array(
                z.object({ index: z.number(), relevant: z.boolean() }),
              ),
            }),
            system:
              'Judge whether each record matches the criteria. Answer relevant=true only if it clearly matches.',
            prompt: `Criteria: ${relevanceCriteria}\n\nRecords:\n${plausible
              .map(
                (document, index) =>
                  `${index}: ${JSON.stringify({
                    title: document.data.current_title,
                    company: document.data.current_company_name,
                    location: document.data.location,
                    name: document.data.name,
                    industry: document.data.industry,
                    hq: document.data.headquarters_location,
                    size: document.data.company_size_from,
                    about: String(document.data.about ?? '').slice(0, 300),
                  })}`,
              )
              .join('\n')}`,
          });

          object.verdicts.forEach((verdict) => {
            const document = plausible[verdict.index];

            if (document) {
              answers.set(document.brightId, verdict.relevant);
            }
          });
        }

        const verdicts = documents
          .filter(
            (document) =>
              !plausible.includes(document) || answers.has(document.brightId),
          )
          .map((document) => ({
            brightId: document.brightId,
            relevant: answers.get(document.brightId) === true,
          }));

        return {
          verdicts,
          precision: verdicts.length
            ? verdicts.filter((verdict) => verdict.relevant).length /
              verdicts.length
            : null,
          judgedBy: 'jev' as const,
        };
      },
    };
    const registry = {
      getDefaultSpeedModel: () => ({ modelId }),
      resolveModelForAgentInWorkspace: async () => ({
        modelId,
        model: openai(modelId),
      }),
    };

    const planner = new BrightDataLudicrousPlannerService(
      search,
      store as never,
      judge as never,
      billing as never,
      registry as never,
      undefined,
    );
    const executor = new BrightDataLudicrousExecutorService(
      search,
      judge as never,
      billing as never,
    );
    const rows: Array<Record<string, unknown>> = [];

    const selected = process.env.EVAL_CASES?.split(',');
    const budgetOverride = process.env.EVAL_BUDGET
      ? Number(process.env.EVAL_BUDGET)
      : undefined;

    for (const evalCase of CASES.filter(
      (entry) => !selected || selected.includes(entry.id),
    )) {
      ledger.records = 0;
      const plan = await planner.createPlan({
        workspaceId: 'eval',
        entity: evalCase.entity,
        rawQuery: evalCase.raw,
      });
      const summary = summarizeBrightDataLudicrousPlan(plan);
      const estimateRecords = ledger.records;
      const run = await executor.execute({
        plan,
        maxBudgetUsd: budgetOverride ?? evalCase.maxBudgetUsd,
      });
      const ludicrousAccurate = run.documents.filter((document) =>
        evalCase.truth(document.data),
      ).length;
      const ludicrousUnique = new Set(run.documents.map((d) => d.brightId))
        .size;
      const totalCost = ledger.records * 0.002;

      // Instant baseline: one 100-record request for the same intent
      const instant = await search.search({
        entity: evalCase.entity,
        mode: 'instant',
        query: evalCase.instantQuery,
        limit: 100,
      });
      const instantAccurate = instant.documents.filter((document) =>
        evalCase.truth(document.data),
      ).length;

      rows.push({
        id: evalCase.id,
        shards: plan.shards.map((shard) => shard.key),
        rubric: plan.rubric,
        criteria: plan.relevanceCriteria,
        queries: plan.shards.map((shard) => shard.query),
        sampleRows: Object.values(plan.sampleDocuments)
          .flat()
          .slice(0, 4)
          .map((document) => document.data),
        estimate: {
          costUsd: plan.estimateCostUsd,
          records: estimateRecords,
          fetchable: summary.totalFetchableRecords,
          unique: summary.estimatedUniqueRecords,
          accurate: summary.estimatedAccurateRecords,
          perShard: summary.shards.map((shard) => ({
            key: shard.key,
            matched: shard.matched,
            fetchable: shard.fetchableRecords,
            precision: shard.samplePrecision,
            error: shard.error,
          })),
        },
        ludicrous: {
          returned: run.documents.length,
          unique: ludicrousUnique,
          accurate: ludicrousAccurate,
          precision: run.documents.length
            ? ludicrousAccurate / run.documents.length
            : 0,
          totalCostUsd: totalCost,
          accuratePerDollar: totalCost ? ludicrousAccurate / totalCost : 0,
          shardReports: run.shardReports,
        },
        instant: {
          returned: instant.documents.length,
          accurate: instantAccurate,
          costUsd: instant.documents.length * 0.002,
          accuratePerDollar:
            instant.documents.length > 0
              ? instantAccurate / (instant.documents.length * 0.002)
              : 0,
          matched: instant.matched,
        },
      });
    }

    writeFileSync(
      process.env.EVAL_OUTPUT_PATH ?? '/tmp/bright-data-ludicrous-eval.json',
      JSON.stringify(rows, null, 2),
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
