import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import { resolveFilteredSets } from './eval-env';
import {
  computeOverallSummaries,
  printModelTable,
  printOverallModelRanking,
  printPerRequirementScores,
  printPromptComparisonTable,
  printSampleQueriesBySearchType,
  printTokenUsageSummary,
} from './eval-reporting';
import {
  buildWorkItems,
  createSearchTypeSectionPrinter,
  executeWorkItem,
  runWorkPool,
  writeQueriesJson,
  writeResultsJson,
} from './eval-work-pool';

export async function main(): Promise<void> {
  const openaiKey    = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openaiKey) {
    console.error('OPENAI_API_KEY missing');
    process.exit(1);
  }

  const openaiClient    = new OpenAI({ apiKey: openaiKey });
  const anthropicClient = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

  const { models, reqs, searchTypes, promptModes } = resolveFilteredSets();
  const total = models.length * reqs.length * searchTypes.length * promptModes.length;

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`LinkedIn Multi-Search-Type Query Generation — Model Evaluation v2`);
  console.log(`Models: ${models.map(m => m.label).join(', ')}`);
  console.log(`Prompt modes: ${promptModes.join(', ')}`);
  console.log(`Requirements: ${reqs.length}  ×  Search types: ${searchTypes.join(', ')}  ×  Prompt modes: ${promptModes.join(', ')}  =  ${total} API calls`);
  console.log(`${'═'.repeat(80)}\n`);

  const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 50);
  const workItems   = buildWorkItems(searchTypes, models, reqs, promptModes);
  const printSearchTypeSection = createSearchTypeSectionPrinter();

  console.log(`Concurrency: ${CONCURRENCY} parallel calls\n`);

  const results = await runWorkPool(workItems, CONCURRENCY, (item) =>
    executeWorkItem(item, total, openaiClient, anthropicClient, printSearchTypeSection),
  );

  const outPath      = writeResultsJson(results);
  const queriesPath  = writeQueriesJson(results);
  console.log(`\nFull results written to:  ${outPath}`);
  console.log(`All queries written to:   ${queriesPath}`);

  for (const st of searchTypes) {
    for (const pm of promptModes) {
      printModelTable(`MODEL RANKING [${pm.toUpperCase()} PROMPT]`, models, results, st, pm);
    }
  }

  if (promptModes.length > 1) {
    printPromptComparisonTable(models, results, searchTypes);
  }

  const overallSummaries = computeOverallSummaries(models, results);
  printOverallModelRanking(overallSummaries);
  printPerRequirementScores(reqs, searchTypes, results);
  printTokenUsageSummary(models, results, overallSummaries);
  printSampleQueriesBySearchType(searchTypes, models, reqs, results);
}
