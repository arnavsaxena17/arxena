import { type FilterFieldSpec } from 'src/engine/core-modules/judge/ai-filter-engine/ai-filter-contract';
import {
  describeFitment,
  scoreFitment,
  toFitmentVerdict,
  type FitmentCriterion,
  type FitmentResult,
  type FitmentStage,
} from 'src/engine/core-modules/judge/fitment-score.util';

export const FITMENT_SCORE_KEY = 'fitmentScore';
export const FITMENT_OUTCOME_KEY = 'fitmentOutcome';
export const FITMENT_REASON_KEY = 'fitmentReason';
// Optional model field: a line naming the evidence. Not a column.
export const FITMENT_EVIDENCE_KEY = 'evidence';

const VERDICT_VALUES = ['pass', 'fail', 'unknown'];

export type FitmentSetup = {
  stage: FitmentStage;
  criteria: FitmentCriterion[];
  // Fixed when the column is previewed, so a run uses the bar the user saw
  threshold: number;
};

const valuesOf = (criterion: FitmentCriterion): string[] =>
  criterion.values ?? VERDICT_VALUES;

// What the model is asked, one verdict field per criterion
export const buildFitmentModelFields = (
  criteria: FitmentCriterion[],
): FilterFieldSpec[] => [
  ...criteria.map(
    (criterion): FilterFieldSpec => ({
      name: criterion.key,
      type: 'enum',
      enumValues: valuesOf(criterion),
      description:
        criterion.values === undefined
          ? `${criterion.description}. pass if it clearly holds, fail if it clearly does not, unknown if the fields shown cannot tell.`
          : `${criterion.description}. One of: ${valuesOf(criterion).join(', ')}.`,
    }),
  ),
  {
    name: FITMENT_EVIDENCE_KEY,
    type: 'text',
    optional: true,
    description: 'One line naming the evidence behind the verdicts',
  },
];

// What the table shows: the verdicts the model gave, then the score, outcome
// and reason that code computes from them
export const buildFitmentColumnFields = (
  criteria: FitmentCriterion[],
): FilterFieldSpec[] => [
  {
    name: FITMENT_OUTCOME_KEY,
    type: 'enum',
    enumValues: VERDICT_VALUES,
    description: 'pass, fail, or unknown (needs the full profile)',
  },
  {
    name: FITMENT_SCORE_KEY,
    type: 'integer',
    description: 'Fitment score, 0 to 100',
  },
  {
    name: FITMENT_REASON_KEY,
    type: 'text',
    description: 'Why the row passed, failed or is unknown',
  },
  ...criteria.map(
    (criterion): FilterFieldSpec => ({
      name: criterion.key,
      type: 'enum',
      enumValues: valuesOf(criterion),
      description: criterion.description,
    }),
  ),
];

// Only a snapshot gets the benefit of the doubt. Every later stage holds the
// full evidence, so an unknown must-have there is a fail, not a fetch.
const STAGE_TEXT: Record<FitmentStage, string> = {
  snapshot:
    'You are shown a snapshot: a partial profile with only the fields a search previews. Skills, full job history, education and the about text are usually missing. A criterion these fields cannot answer is unknown, never fail.',
  profile:
    'You are shown the full profile. Answer unknown only when even the full profile does not say.',
  cv: "You are shown the candidate's CV. Answer unknown only when even the CV does not say.",
  conversation:
    'You are shown the chat conversation with the candidate. Answer unknown only when the conversation does not say.',
  client_feedback:
    "You are shown the client's feedback on the candidate. Answer unknown only when the feedback does not say.",
};

export const buildFitmentPrompt = ({
  stage,
  criteria,
  request,
}: {
  stage: FitmentStage;
  criteria: FitmentCriterion[];
  request?: string;
}): string =>
  [
    request !== undefined && request.trim() !== ''
      ? `The user is looking for: ${request.trim()}`
      : null,
    STAGE_TEXT[stage],
    'Score every criterion on its own as pass, fail or unknown:',
    ...criteria.map(
      (criterion) =>
        `- ${criterion.key} (${criterion.mustHave ? 'must-have' : 'nice-to-have'}): ${criterion.description}${
          criterion.values === undefined
            ? ''
            : ` Answer with one of: ${valuesOf(criterion).join(', ')}.`
        }`,
    ),
    'A title, company or place the person used to hold is not current. Weigh scope as well as the label: the same title means different seniority in different industries and regions. Never turn unknown into fail.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

// The columns for one answered row: the model's verdicts plus the computed
// score, outcome and reason. The score, not the model, decides the outcome.
export const computeFitmentColumns = ({
  answers,
  setup,
}: {
  answers: Record<string, unknown>;
  setup: FitmentSetup;
}): { values: Record<string, string | number>; result: FitmentResult } => {
  const verdicts = Object.fromEntries(
    setup.criteria.map((criterion) => [
      criterion.key,
      toFitmentVerdict(criterion, answers[criterion.key]),
    ]),
  );
  const result = scoreFitment({
    criteria: setup.criteria,
    verdicts,
    stage: setup.stage,
    threshold: setup.threshold,
  });
  const evidence =
    typeof answers[FITMENT_EVIDENCE_KEY] === 'string'
      ? answers[FITMENT_EVIDENCE_KEY].trim()
      : '';
  const description = describeFitment(result, setup.criteria);

  return {
    result,
    values: {
      [FITMENT_OUTCOME_KEY]: result.outcome,
      [FITMENT_SCORE_KEY]: Math.round(result.score * 100),
      [FITMENT_REASON_KEY]:
        evidence === '' ? description : `${description}. ${evidence}`,
    },
  };
};
