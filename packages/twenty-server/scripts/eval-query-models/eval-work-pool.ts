import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import OpenAI from 'openai';
import * as path from 'path';

import { callAgentPipeline } from './call-agent-pipeline';
import { callAnthropic } from './call-anthropic';
import { callOpenAI } from './call-openai';
import { calcCost, type PromptMode, type SearchType } from './constants';
import type { EvalModel, EvalRequirement, RunResult, WorkItem } from './eval-types';
import { EVAL_MODEL, scoreRequestsWithLLM, type ScoreBreakdown } from './scoring';

export function createSearchTypeSectionPrinter(): (searchType: SearchType) => void {
  const seen: Partial<Record<SearchType, boolean>> = {};
  return (searchType: SearchType) => {
    if (seen[searchType]) return;
    seen[searchType] = true;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`SEARCH TYPE: ${searchType.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);
  };
}

export function buildWorkItems(
  searchTypes: SearchType[],
  models: EvalModel[],
  reqs: EvalRequirement[],
  promptModes: PromptMode[],
): WorkItem[] {
  const workItems: WorkItem[] = [];
  let idx = 0;
  for (const promptMode of promptModes) {
    for (const searchType of searchTypes) {
      for (const model of models) {
        for (const req of reqs) {
          workItems.push({ searchType, promptMode, model, req, idx: ++idx });
        }
      }
    }
  }
  return workItems;
}

export async function executeWorkItem(
  item: WorkItem,
  total: number,
  openaiClient: OpenAI,
  anthropicClient: Anthropic | null,
  printSearchTypeSection: (searchType: SearchType) => void,
): Promise<RunResult> {
  const { searchType, promptMode, model, req } = item;
  printSearchTypeSection(searchType);

  process.stdout.write(`[${item.idx}/${total}] ${model.label} × ${req.id} × ${searchType} × ${promptMode} ... `);
  const t0 = Date.now();

  // 'agent' mode runs the agent1→4 pipeline regardless of model.provider
  // (the pipeline uses OpenAI structured outputs internally)
  const { requests, raw, error, inputTokens, outputTokens, cachedTokens } =
    promptMode === 'agent'
      ? await callAgentPipeline(openaiClient, model.id, req.query, searchType)
      : model.provider === 'openai'
        ? await callOpenAI(
            openaiClient,
            model.id,
            req.query,
            searchType,
            model.isReasoning ?? false,
            model.isDeepResearch ?? false,
            promptMode,
          )
        : anthropicClient
          ? await callAnthropic(anthropicClient, model.id, req.query, searchType, promptMode)
          : { requests: [], raw: '', error: 'No Anthropic client', inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  const durationMs = Date.now() - t0;
  const costUsd    = calcCost(model.id, inputTokens, outputTokens, cachedTokens);

  let score: ScoreBreakdown | null = null;
  let evalCostUsd = 0;
  if (requests.length > 0 && !error) {
    try {
      const { score: s, evalTokens } = await scoreRequestsWithLLM(
        openaiClient, requests, searchType, req.query,
      );
      score = s;
      evalCostUsd = calcCost(EVAL_MODEL, evalTokens.input, evalTokens.output);
    } catch (evalErr: unknown) {
      const msg = evalErr instanceof Error ? evalErr.message : String(evalErr);
      process.stderr.write(`  [eval error: ${msg.slice(0, 80)}]`);
    }
  }

  const result: RunResult = {
    modelId:      model.id,
    modelLabel:   model.label,
    reqId:        req.id,
    reqLabel:     req.label,
    searchType,
    promptMode,
    score,
    queries:      requests,
    raw,
    error:        error ?? null,
    durationMs,
    inputTokens,
    outputTokens,
    cachedTokens,
    costUsd,
    evalCostUsd,
  };

  const totalCost = costUsd + evalCostUsd;
  const cacheNote = cachedTokens > 0 ? `  cached=${cachedTokens}(${Math.round(cachedTokens / inputTokens * 100)}%)` : '';
  const status = error
    ? `❌ ERROR: ${error.slice(0, 80)}`
    : `✅ score=${score?.total ?? '?'}/14  n=${requests.length}  in=${inputTokens} out=${outputTokens}${cacheNote}  gen=$${costUsd.toFixed(5)}  eval=$${evalCostUsd.toFixed(5)}  total=$${totalCost.toFixed(5)}  ${durationMs}ms`;
  console.log(status);

  return result;
}

export async function runWorkPool(
  workItems: WorkItem[],
  concurrency: number,
  runOne: (item: WorkItem) => Promise<RunResult>,
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  await new Promise<void>((resolve) => {
    let nextIdx = 0;
    let inFlight = 0;

    function startNext() {
      while (inFlight < concurrency && nextIdx < workItems.length) {
        const item = workItems[nextIdx++];
        inFlight++;
        runOne(item).then((result) => {
          results.push(result);
          inFlight--;
          if (nextIdx < workItems.length) {
            startNext();
          } else if (inFlight === 0) {
            resolve();
          }
        });
      }
    }

    startNext();
    if (workItems.length === 0) resolve();
  });
  return results;
}

export function writeResultsJson(results: RunResult[]): string {
  const outPath = path.join(__dirname, '..', '..', 'eval-query-models-results-v2.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  return outPath;
}

export function writeQueriesJson(results: RunResult[]): string {
  // Group: requirement → searchType → promptMode → model
  type ModelEntry = {
    score: number | null;
    weaknesses: string[] | undefined;
    verdict: string | undefined;
    queries: unknown[];
  };
  const byReq: Record<string, Record<string, Record<string, Record<string, ModelEntry>>>> = {};

  for (const r of results) {
    if (r.error || r.queries.length === 0) continue;
    const reqKey = `${r.reqId} — ${r.reqLabel}`;
    byReq[reqKey] ??= {};
    byReq[reqKey][r.searchType] ??= {};
    byReq[reqKey][r.searchType][r.promptMode] ??= {};
    byReq[reqKey][r.searchType][r.promptMode][r.modelLabel] = {
      score:      r.score?.total ?? null,
      weaknesses: r.score?.weaknesses,
      verdict:    r.score?.verdict,
      queries:    r.queries.map(q => {
        const { api: _a, category: _c, ...clean } = q as Record<string, unknown>;
        return clean;
      }),
    };
  }

  const outPath = path.join(__dirname, '..', '..', 'eval-query-models-queries.json');
  fs.writeFileSync(outPath, JSON.stringify(byReq, null, 2));
  return outPath;
}
