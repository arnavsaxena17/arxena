import { Injectable, Logger } from '@nestjs/common';

import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';
import { type FilterSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousRubric,
  type BrightDataLudicrousSampleDocument,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  computeRubricPrecision,
  passesRubricHardConstraints,
  scoreRecordAgainstRubric,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-relevance.util';
import { JEV_MODEL_ID } from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';

const RELEVANT_FIELD = 'relevant';

export type BrightDataRelevanceVerdict = {
  brightId: string;
  relevant: boolean;
};

export type BrightDataRelevanceJudgement = {
  verdicts: BrightDataRelevanceVerdict[];
  // Share of judged records that are relevant; null when nothing was judged
  precision: number | null;
  judgedBy: 'jev' | 'rubric';
};

const toFilterRecord = (
  entity: BrightDataLudicrousEntity,
  document: BrightDataLudicrousSampleDocument,
): Record<string, unknown> & { id: string } => {
  const data = document.data;

  if (entity === 'people') {
    return {
      id: document.brightId,
      name: data.name,
      title: data.current_title,
      company: data.current_company_name,
      location: data.location,
      headline: data.current_title,
    };
  }

  return {
    id: document.brightId,
    name: data.name,
    industry: data.industry,
    location: data.headquarters_location,
    headline:
      typeof data.about === 'string' ? data.about.slice(0, 300) : data.about,
    title: data.industry,
    company: data.name,
  };
};

// Relevance is judged by Jev (typesafe-ai/jev), the same model the workflow AI
// Filtering action uses. The planner's regex rubric is only the free first pass
// for hard constraints and the fallback if Jev gives no usable answer.
@Injectable()
export class BrightDataLudicrousRelevanceJudgeService {
  private readonly logger = new Logger(
    BrightDataLudicrousRelevanceJudgeService.name,
  );

  constructor(private readonly aiFilterEngineService: AiFilterEngineService) {}

  async judge({
    entity,
    documents,
    relevanceCriteria,
    rubric,
  }: {
    entity: BrightDataLudicrousEntity;
    documents: BrightDataLudicrousSampleDocument[];
    relevanceCriteria: string;
    rubric: BrightDataLudicrousRubric;
  }): Promise<BrightDataRelevanceJudgement> {
    if (documents.length === 0) {
      return { verdicts: [], precision: null, judgedBy: 'rubric' };
    }

    // Rows that already break a hard constraint (wrong country or size bucket)
    // are rejected for free. Title and industry wording is left to Jev because
    // an LLM-written regex can wrongly reject good records.
    const plausible = documents.filter((document) =>
      passesRubricHardConstraints({ entity, data: document.data, rubric }),
    );
    const rejected = documents.filter(
      (document) => !plausible.includes(document),
    );

    if (plausible.length === 0) {
      return {
        verdicts: rejected.map((document) => ({
          brightId: document.brightId,
          relevant: false,
        })),
        precision: 0,
        judgedBy: 'rubric',
      };
    }

    const spec: FilterSpec = {
      name: 'BrightDataLudicrousRelevance',
      subject: entity === 'people' ? 'person' : 'company',
      criteria: relevanceCriteria,
      fields: [
        {
          name: RELEVANT_FIELD,
          type: 'boolean',
          description: 'True when the record matches the criteria',
        },
      ],
      keepField: RELEVANT_FIELD,
      model: JEV_MODEL_ID,
      metadataFields: [
        'name',
        'title',
        'company',
        'location',
        'headline',
        'industry',
      ],
      concurrency: 5,
    };

    try {
      const { verdicts } = await this.aiFilterEngineService.run(
        plausible.map((document) => toFilterRecord(entity, document)),
        spec,
      );

      if (verdicts.every((verdict) => verdict.status === 'failed')) {
        throw new Error(verdicts[0]?.error ?? 'Jev returned no valid answer');
      }

      const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]));
      const judged = plausible
        .map((document) => ({
          brightId: document.brightId,
          verdict: byId.get(document.brightId),
        }))
        // A failed answer is neither relevant nor irrelevant; leave it out
        .filter((entry) => entry.verdict?.status === 'answered');
      const relevantIds = new Set(
        judged
          .filter((entry) => entry.verdict?.keep === true)
          .map((entry) => entry.brightId),
      );
      const all = [
        ...judged.map((entry) => ({
          brightId: entry.brightId,
          relevant: relevantIds.has(entry.brightId),
        })),
        ...rejected.map((document) => ({
          brightId: document.brightId,
          relevant: false,
        })),
      ];

      return {
        verdicts: all,
        precision: all.filter((v) => v.relevant).length / all.length,
        judgedBy: 'jev',
      };
    } catch (error) {
      this.logger.warn(
        `Jev relevance judging failed, falling back to rubric: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        verdicts: documents.map((document) => ({
          brightId: document.brightId,
          relevant: scoreRecordAgainstRubric({
            entity,
            data: document.data,
            rubric,
          }),
        })),
        precision: computeRubricPrecision({
          entity,
          records: documents.map((document) => document.data),
          rubric,
        }),
        judgedBy: 'rubric',
      };
    }
  }
}
