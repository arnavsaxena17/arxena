import { pickManualLinkedInBooleanQuery } from '../pick-manual-linkedin-boolean-query.util';

describe('pickManualLinkedInBooleanQuery', () => {
  const rows = [
    {
      kind: 'std_function',
      label: 'technology',
      stdGrade: 'leadership',
      booleanQuery: '("CTO" OR "chief technology officer")',
      keywords: 'technology OR software',
    },
    {
      kind: 'std_function_root',
      label: 'technology',
      stdGrade: 'leadership',
      booleanQuery: '("CIO" OR "CTO")',
      keywords: 'engineering',
    },
  ];

  it('returns both job-title boolean and keywords from std_function + grade', () => {
    expect(
      pickManualLinkedInBooleanQuery(rows, {
        stdFunction: 'technology',
        stdFunctionRoot: 'technology',
        stdGrade: 'leadership',
      }),
    ).toEqual({
      jobTitle: '("CTO" OR "chief technology officer")',
      keywords: 'technology OR software',
    });
  });

  it('prefers blank-grade root row when no grade is requested', () => {
    expect(
      pickManualLinkedInBooleanQuery(
        [
          {
            kind: 'std_function_root',
            label: 'technology',
            stdGrade: 'entry',
            booleanQuery: 'entry title boolean',
            keywords: 'entry keywords',
          },
          {
            kind: 'std_function_root',
            label: 'technology',
            stdGrade: '',
            booleanQuery:
              '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
            keywords:
              '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
          },
        ],
        { stdFunctionRoot: 'technology' },
      ),
    ).toEqual({
      jobTitle:
        '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
      keywords:
        '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
    });
  });

  it('keeps keywords when boolean_query is empty', () => {
    expect(
      pickManualLinkedInBooleanQuery(
        [
          {
            kind: 'std_function',
            label: 'sales',
            stdGrade: 'mid',
            booleanQuery: '',
            keywords: 'sales manager',
          },
        ],
        { stdFunction: 'sales', stdGrade: 'mid' },
      ),
    ).toEqual({
      keywords: 'sales manager',
    });
  });

  it('returns undefined when nothing is curated', () => {
    expect(pickManualLinkedInBooleanQuery([], { stdFunction: 'sales' })).toEqual(
      undefined,
    );
  });
});
