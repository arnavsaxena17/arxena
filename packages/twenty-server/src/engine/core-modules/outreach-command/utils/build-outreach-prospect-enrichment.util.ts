import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type OutreachQualifyProspectLlmResult } from 'src/engine/core-modules/outreach-command/schemas/outreach-qualify-prospect-llm.schema';

export const hasOutreachOpenerHook = (value: unknown): boolean => {
  if (!isDefined(value) || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const openerHook = record.opener_hook;

  if (
    !isDefined(openerHook) ||
    typeof openerHook !== 'object' ||
    Array.isArray(openerHook)
  ) {
    return false;
  }

  const quote = (openerHook as { quote?: unknown }).quote;
  const problem = (openerHook as { problem?: unknown }).problem;

  // Quote (tier 1/2 fact) or hypothesis observation (tier 2) counts as usable.
  return (
    (typeof quote === 'string' && isNonEmptyString(quote.trim())) ||
    (typeof problem === 'string' && isNonEmptyString(problem.trim()))
  );
};

// Same shape stamped by workflow "Stamp prospect enrichment".
export const buildOutreachProspectEnrichment = (
  result: OutreachQualifyProspectLlmResult,
): Record<string, unknown> => ({
  go: result.go,
  score: result.score,
  segment: result.segment,
  reason: result.reason,
  first_name: result.first_name,
  honorific: result.honorific,
  company_short: result.company_short,
  industry_phrase: result.industry_phrase,
  hooks: result.hooks,
  likely_systems: result.likely_systems,
  matching_problem_statement: result.matching_problem_statement,
  referral_source: result.referral_source,
  opener_hook: result.opener_hook,
});

type LinkedinProfileForEnrichment = {
  firstName: string;
  headline: string;
  experience: Array<{
    company: string;
    position: string;
    end: string;
  }>;
};

// Qualify owns the field once go/score exist. Until then, fetch stamps
// profile facts in the same shape so reply prompts are not empty.
export const isQualifyOwnedProspectEnrichment = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.score === 'number' || typeof record.go === 'boolean';
};

export const buildOutreachProspectEnrichmentFromLinkedinProfile = (
  profile: LinkedinProfileForEnrichment,
): Record<string, unknown> => {
  const currentExperience =
    profile.experience.find((item) => !isNonEmptyString(item.end.trim())) ??
    profile.experience[0];
  const company = currentExperience?.company.trim() ?? '';
  const position = currentExperience?.position.trim() ?? '';
  const role = [position, company].filter(isNonEmptyString).join(' @ ');
  const headline = profile.headline.trim();
  const hooks = [headline, role === headline ? '' : role]
    .filter(isNonEmptyString)
    .slice(0, 3)
    .map((text) => ({ text, source: 'profile' }));

  return {
    first_name: profile.firstName.trim(),
    company_short: company,
    hooks,
  };
};
