// Port of Python CompanyCollector.query_generator (active clauses only)
export const buildResolveCompanyFromRawNameQuery = (
  cleanedCompanyName: string,
): Record<string, unknown> => {
  const tokens = cleanedCompanyName
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const perTokenMust =
    tokens.length > 0
      ? tokens.map((token) => ({
          match: {
            'name.text': {
              query: token,
              boost: 0.45 / tokens.length,
            },
          },
        }))
      : [];

  return {
    bool: {
      must_not: [],
      must: [
        { exists: { field: 'linkedin_url' } },
        { exists: { field: 'count_org' } },
        {
          bool: {
            should: [
              {
                match_phrase: {
                  name: {
                    query: cleanedCompanyName,
                    boost: 100.55,
                    analyzer: 'synonym',
                  },
                },
              },
              {
                match: {
                  name: {
                    query: cleanedCompanyName,
                    boost: 5.55,
                    analyzer: 'synonym',
                  },
                },
              },
              ...(perTokenMust.length > 0
                ? [
                    {
                      bool: {
                        must: perTokenMust,
                      },
                    },
                  ]
                : []),
            ],
            must_not: [
              {
                terms: {
                  name: [cleanedCompanyName],
                  boost: 0,
                },
              },
            ],
          },
        },
      ],
      should: [
        {
          function_score: {
            query: { match_all: {} },
            functions: [
              {
                field_value_factor: {
                  field: 'count_org',
                  modifier: 'sqrt',
                  missing: 1,
                  factor: 1,
                },
              },
              {
                script_score: {
                  script: {
                    source:
                      '(_score*0.9+0.1*Math.log(doc[\'count_org\'].value + 1));',
                  },
                },
              },
            ],
            score_mode: 'sum',
          },
        },
      ],
    },
  };
};
