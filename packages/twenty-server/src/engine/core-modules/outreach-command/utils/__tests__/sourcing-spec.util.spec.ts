import { type ParsedRequirement } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import {
  mergeSourcingBrief,
  normalizeSourcingBriefDraft,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import {
  normalizeSourcingSpecDraft,
  resolveSourcingSpec,
  sourcingSpecFromParsedRequirement,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

const parsedRequirement = (
  overrides: Partial<ParsedRequirement> = {},
): ParsedRequirement => ({
  original_requirement: 'CHROs of food processing companies in Mumbai',
  query_type: 'C',
  query_type_description: 'seniority across a segment',
  position_title: 'CHRO',
  seniority_level: 'C-level',
  domain_expertise: ['Food Processing'],
  technical_skills: ['SAP SuccessFactors'],
  industry_terms: [],
  certifications: [],
  target_companies: [],
  location: ['Mumbai'],
  years_min: 15,
  precision_vs_recall: 'balanced',
  salary_range: '1-2 Cr',
  ...overrides,
});

describe('sourcingSpecFromParsedRequirement', () => {
  it('should make identity hard and expertise soft', () => {
    const spec = sourcingSpecFromParsedRequirement(parsedRequirement(), {
      targetCount: 30,
      budgetUsd: 5,
    });

    expect(spec.hard.map((constraint) => constraint.field)).toEqual([
      'title',
      'seniority',
      'location',
      'experience_years',
    ]);
    expect(spec.soft.map((constraint) => constraint.field)).toEqual([
      'skill',
      'industry',
      'salary',
    ]);
    expect(spec.hard[0]).toEqual({
      field: 'title',
      userWords: 'CHRO',
      normalized: ['chro'],
    });
    expect(spec.hard[3].range).toEqual({ min: 15 });
    expect(spec.normalized).toEqual({
      titles: ['chro'],
      industries: ['food processing'],
    });
    expect(spec.target).toEqual({ count: 30 });
    expect(spec.budgetUsd).toBe(5);
    expect(spec.queryType).toBe('C');
  });

  it('should make skills hard for a high precision ask', () => {
    const spec = sourcingSpecFromParsedRequirement(
      parsedRequirement({ precision_vs_recall: 'high_precision' }),
    );

    expect(spec.hard.map((constraint) => constraint.field)).toContain('skill');
    expect(spec.soft.map((constraint) => constraint.field)).not.toContain(
      'skill',
    );
  });
});

describe('normalizeSourcingSpecDraft', () => {
  it('should accept strings, a bare target and drop bad values', () => {
    expect(
      normalizeSourcingSpecDraft({
        hard: ['Head of Supply Chain'],
        soft: [{ userWords: 'SAP', field: 'skill', weight: 2 }],
        exclusions: 'Tata group',
        target: 50,
        budgetUsd: '3',
        queryType: 'Z',
      }),
    ).toEqual({
      hard: [
        {
          field: 'other',
          userWords: 'Head of Supply Chain',
          normalized: ['head of supply chain'],
        },
      ],
      soft: [
        { field: 'skill', userWords: 'SAP', normalized: ['sap'], weight: 2 },
      ],
      exclusions: [
        { field: 'other', userWords: 'Tata group', normalized: ['tata group'] },
      ],
      target: { count: 50 },
      budgetUsd: 3,
    });
  });

  it('should keep only the fields that were sent', () => {
    expect(normalizeSourcingSpecDraft({ budgetUsd: 2 })).toEqual({
      budgetUsd: 2,
    });
    expect(normalizeSourcingSpecDraft('CHROs')).toBeUndefined();
  });
});

describe('brief spec', () => {
  it('should merge a later spec over the earlier one, field by field', () => {
    const first = mergeSourcingBrief(
      undefined,
      normalizeSourcingBriefDraft({
        who: 'CHROs',
        spec: { hard: ['CHRO'], target: 20 },
      }) ?? {},
    );
    const second = mergeSourcingBrief(
      first,
      normalizeSourcingBriefDraft({ spec: { budgetUsd: 4 } }) ?? {},
    );

    expect(second.spec?.hard[0].userWords).toBe('CHRO');
    expect(second.spec?.target).toEqual({ count: 20 });
    expect(second.spec?.budgetUsd).toBe(4);
  });

  it('should resolve a spec from a brief written before spec existed', () => {
    const brief = mergeSourcingBrief(undefined, {
      who: 'Plant heads',
      target: 25,
      criteria: [
        { description: 'runs a plant', mustHave: true },
        { description: 'FMCG background', mustHave: false },
      ],
      exclusions: 'Nestle; current clients',
      capsUsd: { run: 6 },
      coverage: 'exhaustive',
      sources: ['bright-data'],
    });

    const spec = resolveSourcingSpec(brief);

    expect(spec.hard.map((constraint) => constraint.userWords)).toEqual([
      'runs a plant',
    ]);
    expect(spec.soft.map((constraint) => constraint.userWords)).toEqual([
      'FMCG background',
    ]);
    expect(spec.exclusions.map((constraint) => constraint.userWords)).toEqual([
      'Nestle',
      'current clients',
    ]);
    expect(spec.target).toEqual({ count: 25 });
    expect(spec.budgetUsd).toBe(6);
    expect(spec.coverage).toBe('exhaustive');
    expect(spec.sources).toEqual(['bright-data']);
  });
});
