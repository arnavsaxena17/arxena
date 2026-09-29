import {
  buildOutreachProspectEnrichment,
  buildOutreachProspectEnrichmentFromLinkedinProfile,
  isQualifyOwnedProspectEnrichment,
} from 'src/engine/core-modules/outreach-command/utils/build-outreach-prospect-enrichment.util';

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

describe('buildOutreachProspectEnrichmentFromLinkedinProfile', () => {
  it('stamps first name, current company, and profile hooks', () => {
    expect(
      buildOutreachProspectEnrichmentFromLinkedinProfile({
        firstName: 'Mohammad',
        headline: 'Director Of Operations - Saudi Paper Group',
        experience: [
          {
            company: 'Saudi Paper Group',
            position: 'Director Of Operations',
            end: '',
          },
        ],
      }),
    ).toEqual({
      first_name: 'Mohammad',
      company_short: 'Saudi Paper Group',
      hooks: [
        {
          text: 'Director Of Operations - Saudi Paper Group',
          source: 'profile',
        },
        {
          text: 'Director Of Operations @ Saudi Paper Group',
          source: 'profile',
        },
      ],
    });
  });

  it('treats a qualify stamp as owned and a profile stub as replaceable', () => {
    expect(isQualifyOwnedProspectEnrichment({ go: true, score: 4 })).toBe(true);
    expect(
      isQualifyOwnedProspectEnrichment({
        first_name: 'Mohammad',
        hooks: [{ text: 'Director', source: 'profile' }],
      }),
    ).toBe(false);
  });
});
