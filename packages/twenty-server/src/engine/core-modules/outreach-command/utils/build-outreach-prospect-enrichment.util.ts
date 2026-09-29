import { isNonEmptyString } from '@sniptt/guards';

import { type OutreachQualifyProspectLlmResult } from 'src/engine/core-modules/outreach-command/schemas/outreach-qualify-prospect-llm.schema';

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
