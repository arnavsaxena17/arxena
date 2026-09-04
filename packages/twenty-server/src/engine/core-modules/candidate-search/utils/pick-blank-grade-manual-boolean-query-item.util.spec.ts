import { pickBlankGradeManualBooleanQueryItem } from './pick-blank-grade-manual-boolean-query-item.util';

describe('pickBlankGradeManualBooleanQueryItem', () => {
  it('prefers blank-grade row when entry appears first', () => {
    const picked = pickBlankGradeManualBooleanQueryItem([
      {
        kind: 'std_function_root',
        label: 'technology',
        std_grade: 'entry',
        boolean_query:
          '((technology OR IT OR engineering OR software) AND (coordinator OR associate OR analyst OR intern OR junior OR assistant)) OR "Junior Engineer"',
        keywords: '(technology OR IT OR engineering OR software)',
      },
      {
        kind: 'std_function_root',
        label: 'technology',
        std_grade: '',
        boolean_query:
          '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
        keywords:
          '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
      },
    ]);

    expect(picked?.std_grade).toBe('');
    expect(picked?.boolean_query).toBe(
      '(technology OR software OR data OR IT OR AI OR Architect OR Architecture OR CTO OR CIO)',
    );
  });

  it('falls back to first item when no blank-grade row exists', () => {
    const picked = pickBlankGradeManualBooleanQueryItem([
      {
        kind: 'std_function_root',
        label: 'technology',
        std_grade: 'entry',
        boolean_query: 'entry query',
      },
    ]);

    expect(picked?.boolean_query).toBe('entry query');
  });
});
