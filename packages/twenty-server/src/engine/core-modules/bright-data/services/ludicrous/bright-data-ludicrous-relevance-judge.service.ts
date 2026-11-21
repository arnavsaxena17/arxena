import { Injectable, Logger } from '@nestjs/common';

import { JudgeService } from 'src/engine/core-modules/judge/judge.service';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousRubric,
  type BrightDataLudicrousSampleDocument,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  computeRubricPrecision,
  passesRubricHardConstraints,
  readPersonProfileText,
  scoreRecordAgainstRubric,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-relevance.util';
import { getFitmentThreshold } from 'src/engine/core-modules/judge/fitment-threshold.util';

const RELEVANT_FIELD = 'relevant';

// Enough of the about text and degrees to show a specialty, short enough that
// a page of people stays a cheap judgement
const PROFILE_TEXT_MAX_CHARS = 600;

// Planner criteria often say "a title explicitly indicating X". A generic
// title with the specialty in the profile is still X, so the judge is told so.
const GENERIC_TITLE_RULE =
  'A generic title (consultant, physician, doctor, specialist, manager, engineer) still matches when the headline, profile text, skills or degrees name the required specialty or function. Judge the person, not only the title wording.';

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
    // The title alone hides a specialty behind "Consultant" or "Physician";
    // the headline, about, skills and degrees are where it shows
    const profileText = readPersonProfileText(data);

    return {
      id: document.brightId,
      name: data.name,
      title: data.current_title,
      company: data.current_company_name,
      location: data.location,
      headline:
        typeof data.position === 'string' && data.position.length > 0
          ? data.position
          : data.current_title,
      profile: profileText.slice(0, PROFILE_TEXT_MAX_CHARS),
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

// Relevance is judged by the shared judge (Jev by default), the same path the
// workflow AI Filtering action and the sourcing tools use. The planner's regex
// rubric is only the free first pass for hard constraints and the fallback if
// the judge gives no usable answer.
@Injectable()
export class BrightDataLudicrousRelevanceJudgeService {
  private readonly logger = new Logger(
    BrightDataLudicrousRelevanceJudgeService.name,
  );

  constructor(private readonly judgeService: JudgeService) {}

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

    try {
      const { results } = await this.judgeService.judgeStage(
        plausible.map((document) => toFilterRecord(entity, document)),
        {
          name: 'BrightDataLudicrousRelevance',
          subject: entity === 'people' ? 'person' : 'company',
          // A search sample is a preview: an unanswered row is neither
          // relevant nor irrelevant, so it is left out rather than failed
          stage: 'snapshot',
          criteria: [
            {
              key: RELEVANT_FIELD,
              description:
                entity === 'people'
                  ? `${relevanceCriteria}\n${GENERIC_TITLE_RULE}`
                  : relevanceCriteria,
              mustHave: true,
              weight: 1,
              values: ['true', 'false'],
              passValues: ['true'],
              failValues: ['false'],
            },
          ],
          metadataFields: [
            'name',
            'title',
            'company',
            'location',
            'headline',
            'industry',
            'profile',
          ],
          threshold: getFitmentThreshold(),
          concurrency: 5,
        },
      );

      if (results.size === 0) {
        throw new Error('Jev returned no valid answer');
      }

      const judged = plausible
        .map((document) => ({
          brightId: document.brightId,
          result: results.get(document.brightId),
        }))
        // A failed answer is neither relevant nor irrelevant; leave it out
        .filter((entry) => entry.result !== undefined);
      const relevantIds = new Set(
        judged
          .filter((entry) => entry.result?.verdicts[RELEVANT_FIELD] === 'pass')
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
