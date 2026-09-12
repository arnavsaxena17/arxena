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
