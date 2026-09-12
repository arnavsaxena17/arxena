import { buildOutreachProspectEnrichment } from 'src/engine/core-modules/outreach-command/utils/build-outreach-prospect-enrichment.util';

describe('buildOutreachProspectEnrichment', () => {
  it('maps LLM result into the workflow stamp shape', () => {
    expect(
      buildOutreachProspectEnrichment({
        go: true,
        score: 4,
        segment: 'ops leaders',
        reason: 'role + company fit',
        first_name: 'Ada',
        honorific: '',
        company_short: 'Acme',
        industry_phrase: 'industrial software',
        hooks: '[{"text":"hiring ops","source":"profile"}]',
        likely_systems: 'SAP',
        matching_problem_statement: 'manual handoffs',
        referral_source: '',
      }),
    ).toEqual({
      go: true,
      score: 4,
      segment: 'ops leaders',
      reason: 'role + company fit',
      first_name: 'Ada',
      honorific: '',
      company_short: 'Acme',
      industry_phrase: 'industrial software',
      hooks: '[{"text":"hiring ops","source":"profile"}]',
      likely_systems: 'SAP',
      matching_problem_statement: 'manual handoffs',
      referral_source: '',
    });
  });
});
