import {
  COMPANY_WEB_SETTLES,
  PROFILE_SETTLES,
  type ResultDimension,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-result-fields.constant';
import { type RowCoverage } from 'src/engine/core-modules/tool/tools/source-capabilities-tool/row-coverage.util';

// Given what a row already answers and the user's criteria, which steps are
// worth paying for, in order, and which criteria no picked source can settle.
// Pure: no provider calls, no model. The planner decides; the model reads.

export type ScoringCriterion = {
  key: string;
  description: string;
  mustHave: boolean;
};

export type EnrichmentStep = 'fetch_profile' | 'company_web';

export type PlannedStep = {
  step: EnrichmentStep;
  settles: string[];
  estimatedCostUsd: number;
  why: string;
};

export type ScoringPlan = {
  level: RowCoverage['level'];
  steps: PlannedStep[];
  // Must-haves that no step can settle; report them unknown, never fail silently
  unsettleable: Array<{ key: string; reason: string }>;
  // What the row can be scored on if the plan runs
  coverageAfter: ResultDimension[];
};

export const STEP_COSTS_USD: Readonly<Record<EnrichmentStep, number>> = {
  fetch_profile: 0.02,
  company_web: 0.03,
};

// A criterion's dimension, from its words. Deterministic on purpose: the same
// criterion must plan the same way in every run.
const DIMENSION_PATTERNS: Array<{ dimension: ResultDimension; pattern: RegExp }> = [
  // Order matters: the first pattern that matches wins, so a person-level
  // "experience in payments" is work history, not the employer's industry
  { dimension: 'tenure', pattern: /\b(years?|tenure|since (19|20)\d{2})\b/i },
  { dimension: 'skills', pattern: /\b(p&l|p and l|profit and loss|budget|cost cent(er|re))\b/i },
  { dimension: 'skills', pattern: /\bexperience\b|\bworked (on|with|at)\b|\bhas (built|run|led)\b|\bbackground in\b|\bskilled\b|\bexpertise\b/i },
  { dimension: 'employerRevenue', pattern: /\b(revenue|turnover|topline|top line|annual sales)\b/i },
  { dimension: 'employerSize', pattern: /\b(employees?|headcount|head count|company size|workforce)\b/i },
  { dimension: 'employerIndustry', pattern: /\b(industry|sector|segment|manufactur\w*|retail chain|fintech)\b/i },
  { dimension: 'role', pattern: /\b(title|role|head of|vp\b|vice president|director|coo\b|ceo\b|cfo\b|cto\b|plant head|manager)\b/i },
  { dimension: 'location', pattern: /\b(based in|located in|city|state|region|pune|mumbai|bangalore|bengaluru|gujarat|india)\b/i },
  { dimension: 'contact', pattern: /\b(email|phone|mobile|contact|whatsapp)\b/i },
];

export const dimensionOfCriterion = (
  description: string,
): ResultDimension | undefined =>
  DIMENSION_PATTERNS.find((entry) => entry.pattern.test(description))?.dimension;

const unique = <TValue>(values: TValue[]): TValue[] => [...new Set(values)];

export const planScoring = ({
  coverage,
  criteria,
  budgetUsd,
  profileAlreadyPaid = false,
}: {
  coverage: RowCoverage;
  criteria: ScoringCriterion[];
  budgetUsd: number;
  // A person whose profile is already on the row never pays for one twice
  profileAlreadyPaid?: boolean;
}): ScoringPlan => {
  const mustHaves = criteria.filter((criterion) => criterion.mustHave);
  const unsettleable: ScoringPlan['unsettleable'] = [];
  const open = new Set<ResultDimension>();

  for (const criterion of mustHaves) {
    const dimension = dimensionOfCriterion(criterion.description);

    if (dimension === undefined) {
      continue;
    }
    if (coverage.answered.includes(dimension)) {
      continue;
    }
    open.add(dimension);
  }

  const steps: PlannedStep[] = [];
  let remainingBudget = budgetUsd;
  let settledBy = new Set<ResultDimension>(coverage.answered);

  const profileSettles = [...open].filter(
    (dimension) =>
      PROFILE_SETTLES.includes(dimension) &&
      !settledBy.has(dimension) &&
      coverage.level === 'snapshot' &&
      !profileAlreadyPaid,
  );

  if (profileSettles.length > 0 && remainingBudget >= STEP_COSTS_USD.fetch_profile) {
    steps.push({
      step: 'fetch_profile',
      settles: profileSettles,
      estimatedCostUsd: STEP_COSTS_USD.fetch_profile,
      why: `The row is a search snapshot; ${profileSettles.join(', ')} need the full profile.`,
    });
    remainingBudget -= STEP_COSTS_USD.fetch_profile;
    settledBy = new Set([...settledBy, ...profileSettles]);
    for (const dimension of profileSettles) {
      open.delete(dimension);
    }
  }

  const webSettles = [...open].filter(
    (dimension) =>
      COMPANY_WEB_SETTLES.includes(dimension) && !settledBy.has(dimension),
  );

  if (webSettles.length > 0 && remainingBudget >= STEP_COSTS_USD.company_web) {
    steps.push({
      step: 'company_web',
      settles: webSettles,
      estimatedCostUsd: STEP_COSTS_USD.company_web,
      why: `No structured source on the picked list carries ${webSettles.join(', ')}; one web column settles it.`,
    });
    remainingBudget -= STEP_COSTS_USD.company_web;
    settledBy = new Set([...settledBy, ...webSettles]);
    for (const dimension of webSettles) {
      open.delete(dimension);
    }
  }

  for (const criterion of mustHaves) {
    const dimension = dimensionOfCriterion(criterion.description);

    if (dimension === undefined) {
      continue;
    }
    if (settledBy.has(dimension)) {
      continue;
    }
    if (coverage.answered.includes(dimension)) {
      continue;
    }

    const canProfile = PROFILE_SETTLES.includes(dimension);
    const canWeb = COMPANY_WEB_SETTLES.includes(dimension);
    // A profile that is already on the row and silent is a data gap, not a
    // missing step: saying so is the honest end state
    const atBestLevel =
      coverage.level === 'profile' &&
      canProfile &&
      !canWeb;

    const reason = !canProfile && !canWeb
      ? `No source settles ${dimension}`
      : atBestLevel
        ? `The profile on the row does not show ${dimension}`
        : remainingBudget < Math.min(STEP_COSTS_USD.fetch_profile, STEP_COSTS_USD.company_web)
          ? `Budget left ($${remainingBudget.toFixed(3)}) does not cover the next step for ${dimension}`
          : `The step that settles ${dimension} is not available on this row`;

    unsettleable.push({ key: criterion.key, reason });
  }

  return {
    level: coverage.level,
    steps,
    unsettleable,
    coverageAfter: unique([...settledBy, ...coverage.partial]),
  };
};
