import { Injectable } from '@nestjs/common';

import {
  type FilterRunStats,
  type FilterSubject,
} from 'src/engine/core-modules/judge/ai-filter-engine/ai-filter-contract';
import { AiFilterEngineService } from 'src/engine/core-modules/judge/ai-filter-engine/ai-filter-engine.service';
import { JEV_MODEL_ID } from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';
import {
  type FitmentCriterion,
  type FitmentResult,
  type FitmentStage,
  describeFitment,
  scoreFitment,
  toFitmentVerdict,
} from 'src/engine/core-modules/judge/fitment-score.util';
import { resolveFitmentThreshold } from 'src/engine/core-modules/judge/fitment-threshold.util';
import {
  FITMENT_EVIDENCE_KEY,
  buildFitmentModelFields,
  buildFitmentPrompt,
} from 'src/engine/core-modules/judge/judge-prompt';

export type JudgementSpec = {
  name: string;
  subject: FilterSubject;
  // What evidence the rows hold, which decides whether unknown means fail
  stage: FitmentStage;
  criteria: FitmentCriterion[];
  // The user's request in their own words, for prompt context
  request?: string;
  context?: string;
  // A caller may raise the bar, never lower it below the server's
  threshold?: number;
  // Omit for the jev fast path
  model?: string;
  webSearch?: boolean;
  // Which fields of each row the model reads
  metadataFields: string[];
  // Bars for individual yes/no criteria, for judgements whose questions cost
  // different amounts to get wrong
  fieldThresholds?: Record<string, number>;
  batchSize?: number;
  concurrency?: number;
};

export type JudgementOutcome = FitmentResult & {
  verdicts: Record<string, string>;
  reason: string;
};

export type JudgementRun = {
  // Rows the model did not answer are absent, never failed or rejected
  results: Map<string, JudgementOutcome>;
  stats: FilterRunStats;
};

// Judges rows at one stage against one rubric. Stage is a parameter, not a
// service: it decides whether an unknown criterion means "needs the profile"
// (snapshot) or "fails" (every later stage). The model is the engine's
// decision: jev for boolean/enum criteria, an LLM for prose or web search.
@Injectable()
export class JudgeService {
  constructor(private readonly aiFilterEngineService: AiFilterEngineService) {}

  async judgeStage(
    rows: Array<{ id: string } & Record<string, unknown>>,
    spec: JudgementSpec,
  ): Promise<JudgementRun> {
    const threshold = resolveFitmentThreshold(spec.threshold);

    if (rows.length === 0 || spec.criteria.length === 0) {
      return {
        results: new Map(),
        stats: {
          engine: 'jev',
          model: spec.model ?? JEV_MODEL_ID,
          calls: 0,
          retriedRecords: 0,
          durationMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          webSearchCalls: 0,
          groundedSearches: 0,
          groundedSearchCostUsd: 0,
          webSearchProviders: {},
          estimatedCostUsd: null,
        },
      };
    }

    const { verdicts, stats } = await this.aiFilterEngineService.run(rows, {
      name: spec.name,
      subject: spec.subject,
      criteria: buildFitmentPrompt({
        stage: spec.stage,
        criteria: spec.criteria,
        request: spec.request,
      }),
      ...(spec.context !== undefined && { context: spec.context }),
      fields: buildFitmentModelFields(spec.criteria),
      // Fitment is an enrichment: the outcome comes from the score, never from
      // a keep field the model could set
      keepField: undefined,
      model: spec.model ?? JEV_MODEL_ID,
      metadataFields: spec.metadataFields,
      allowUnknown: true,
      probabilityThreshold: threshold,
      ...(spec.fieldThresholds !== undefined && {
        probabilityThresholds: spec.fieldThresholds,
      }),
      ...(spec.webSearch !== undefined && { webSearch: spec.webSearch }),
      ...(spec.batchSize !== undefined && { batchSize: spec.batchSize }),
      ...(spec.concurrency !== undefined && {
        concurrency: spec.concurrency,
      }),
    });

    const results = new Map<string, JudgementOutcome>();

    for (const verdict of verdicts) {
      if (verdict.status !== 'answered') {
        continue;
      }

      const criterionVerdicts = Object.fromEntries(
        spec.criteria.map((criterion) => [
          criterion.key,
          toFitmentVerdict(criterion, verdict.answers[criterion.key]),
        ]),
      );
      const result = scoreFitment({
        criteria: spec.criteria,
        verdicts: criterionVerdicts,
        stage: spec.stage,
        threshold,
      });
      const evidence =
        typeof verdict.answers[FITMENT_EVIDENCE_KEY] === 'string'
          ? String(verdict.answers[FITMENT_EVIDENCE_KEY]).trim()
          : '';
      const description = describeFitment(result, spec.criteria);

      results.set(verdict.id, {
        ...result,
        verdicts: criterionVerdicts,
        reason: evidence === '' ? description : `${description}. ${evidence}`,
      });
    }

    return { results, stats };
  }
}
