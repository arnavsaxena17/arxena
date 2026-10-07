import {
  compileBooleanTitleString,
  compileTitleGroups,
  stripBooleanSyntax,
  validateAndNormalizeLudicrousQuery,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-query.util';
import { compileShardFilter } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-shard-compiler.util';

describe('bright data ludicrous query util', () => {
  it('compiles titles into an or of all-words clauses', () => {
    expect(
      compileTitleGroups({
        field: 'current_title',
        titles: ['Head of Engineering', 'VP Engineering'],
      }),
    ).toEqual({
      or: [
        {
          text: {
            current_title: { value: 'head of engineering', mode: 'all' },
          },
        },
        { text: { current_title: { value: 'vp engineering', mode: 'all' } } },
      ],
    });
  });

  it('adds a not clause for excluded title words', () => {
    const query = compileTitleGroups({
      field: 'current_title',
      titles: ['engineering director'],
      excludeWords: ['assistant', 'intern'],
    });

    expect(query).toEqual({
      and: [
        {
          text: {
            current_title: { value: 'engineering director', mode: 'all' },
          },
        },
        {
          not: {
            text: { current_title: { value: 'assistant intern', mode: 'any' } },
          },
        },
      ],
    });
  });

  it('compiles a boolean title string into and/or/not', () => {
    expect(
      compileBooleanTitleString({
        field: 'current_title',
        expression: '(head OR vp) AND engineering NOT assistant',
      }),
    ).toEqual({
      and: [
        {
          or: [
            { text: { current_title: { value: 'head', mode: 'all' } } },
            { text: { current_title: { value: 'vp', mode: 'all' } } },
          ],
        },
        { text: { current_title: { value: 'engineering', mode: 'all' } } },
        {
          not: { text: { current_title: { value: 'assistant', mode: 'all' } } },
        },
      ],
    });
  });

  it('strips boolean syntax the engine would read as plain words', () => {
    expect(stripBooleanSyntax('(head OR vp) AND "engineering"')).toBe(
      'head vp engineering',
    );
  });

  it('rejects text without a mode because top-bm25 caps before filters', () => {
    const result = validateAndNormalizeLudicrousQuery({
      entity: 'people',
      query: { text: { current_title: 'head of engineering' } },
    });

    expect(result.issues[0].message).toContain('mode');
  });

  it('normalizes country aliases, city spellings and enum casing', () => {
    const company = validateAndNormalizeLudicrousQuery({
      entity: 'company',
      query: {
        and: [
          { equals: { headquarters_country_code: 'UK' } },
          { equals: { headquarters_city: 'bangalore' } },
          { equals: { organization_type: 'privately held' } },
        ],
      },
    });

    expect(company.issues).toEqual([]);
    expect(company.query).toEqual({
      and: [
        { equals: { headquarters_country_code: 'GB' } },
        { in: { headquarters_city: ['Bengaluru', 'Bangalore'] } },
        { equals: { organization_type: 'Privately Held' } },
      ],
    });

    const people = validateAndNormalizeLudicrousQuery({
      entity: 'people',
      query: { equals: { city: 'Bangalore' } },
    });

    expect(people.query).toEqual({ equals: { city: 'Bengaluru' } });
  });

  it('flags invalid enum values, unknown fields and wrong operators', () => {
    const issues = validateAndNormalizeLudicrousQuery({
      entity: 'company',
      query: {
        and: [
          { equals: { funding_stage: 'Series A' } },
          { equals: { bogus: 1 } },
          { equals: { industry: 'software' } },
        ],
      },
    }).issues;

    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('not a valid funding_stage'),
      expect.stringContaining('unknown company field'),
      expect.stringContaining('does not accept equals'),
    ]);
  });

  it('compiles a flat shard filter to a validated query', () => {
    const { query } = compileShardFilter({
      entity: 'people',
      filter: {
        titles: ['head of growth', 'vp growth'],
        countryCodes: ['india'],
        cities: ['Bangalore'],
      },
    });

    expect(query).toEqual({
      and: [
        {
          or: [
            {
              text: { current_title: { value: 'head of growth', mode: 'all' } },
            },
            { text: { current_title: { value: 'vp growth', mode: 'all' } } },
          ],
        },
        { equals: { country_code: 'IN' } },
        { equals: { city: 'Bengaluru' } },
      ],
    });
  });

  it('compiles company filters with size buckets and funding stages', () => {
    const { query } = compileShardFilter({
      entity: 'company',
      filter: {
        industries: ['Software Development'],
        countryCodes: ['IN'],
        sizeBuckets: ['51', '201'],
        fundingStages: ['series-a', 'series-b'],
      },
    });

    expect(query).toEqual({
      and: [
        {
          text: {
            industry: { value: 'Software Development', mode: 'all' },
          },
        },
        { equals: { headquarters_country_code: 'IN' } },
        { in: { funding_stage: ['series-a', 'series-b'] } },
        {
          or: [
            { equals: { company_size_from: 51 } },
            { equals: { company_size_from: 201 } },
          ],
        },
      ],
    });
  });
});

describe('bright data ludicrous industry taxonomy guard', () => {
  it('moves non-taxonomy industries into specialties keywords', () => {
    const { query } = compileShardFilter({
      entity: 'company',
      filter: {
        industries: ['Fintech', 'Financial Services'],
        countryCodes: ['US'],
      },
    });

    expect(query).toEqual({
      and: [
        {
          text: {
            industry: { value: 'Financial Services', mode: 'all' },
          },
        },
        { equals: { headquarters_country_code: 'US' } },
        { text: { specialties: { value: 'Fintech', mode: 'all' } } },
      ],
    });
  });
});
