import {
    buildOtherFieldsFromLegacyRows,
    buildOtherFieldsFromUnmapped,
    candidateFieldValuesToOtherFields,
    getCandidateCustomField,
    getResolvedOtherFields,
    isJsonColumnEmpty,
    mergeChatQuestionsPreservingOrder,
    mergeOtherFields,
    otherFieldsToFlatRow,
    parseRowOtherFields,
    questionTextToKey,
    questionsRequireAnswerRemap,
    remapOtherFieldsForQuestionChanges,
} from './otherFields';

describe('otherFields utils', () => {
  it('buildOtherFieldsFromUnmapped skips excluded keys', () => {
    const result = buildOtherFieldsFromUnmapped([
      { key: 'age', value: 30 },
      { key: 'inferred_salary', value: '15L' },
    ]);

    expect(result).toEqual({ inferred_salary: '15L' });
  });

  it('questionTextToKey slugifies question text', () => {
    expect(questionTextToKey('What is your current and expected CTC?')).toBe(
      'what_is_your_current_and_expected_ctc',
    );
  });

  it('mergeOtherFields merges and removes empty values', () => {
    expect(
      mergeOtherFields({ inferred_salary: '10L' }, {
        inferred_salary: '',
        skills: '["java"]',
      }),
    ).toEqual({ skills: ['java'] });
  });

  it('otherFieldsToFlatRow converts keys to camelCase', () => {
    expect(
      otherFieldsToFlatRow({
        inferred_salary: '15L',
        job_title: 'Engineer',
      }),
    ).toEqual({
      inferredSalary: '15L',
      jobTitle: 'Engineer',
    });
  });

  it('candidateFieldValuesToOtherFields migrates legacy edges', () => {
    expect(
      candidateFieldValuesToOtherFields([
        {
          node: {
            name: '15L',
            candidateFields: { name: 'inferred_salary' },
          },
        },
      ]),
    ).toEqual({ inferred_salary: '15L' });
  });

  it('getResolvedOtherFields falls back to legacy candidateFieldValues', () => {
    expect(
      getResolvedOtherFields({
        candidateFieldValues: {
          edges: [
            {
              node: {
                name: '15L',
                candidateFields: { name: 'inferred_salary' },
              },
            },
          ],
        },
      }),
    ).toEqual({ inferred_salary: '15L' });
  });

  it('getCandidateCustomField prefers otherFields over legacy values', () => {
    const value = getCandidateCustomField(
      {
        otherFields: { inferred_salary: '20L' },
        candidateFieldValues: {
          edges: [
            {
              node: {
                name: '10L',
                candidateFields: { name: 'inferred_salary' },
              },
            },
          ],
        },
      },
      'inferredSalary',
    );

    expect(value).toBe('20L');
  });

  it('remapOtherFieldsForQuestionChanges renames answer keys', () => {
    const result = remapOtherFieldsForQuestionChanges(
      {
        what_is_your_current_ctc: '18 LPA',
      },
      ['What is your current CTC?'],
      ['What is your current and expected CTC?'],
    );

    expect(result).toEqual({
      what_is_your_current_and_expected_ctc: '18 LPA',
    });
  });

  it('mergeChatQuestionsPreservingOrder appends without reordering', () => {
    expect(
      mergeChatQuestionsPreservingOrder(
        ['Question A', 'Question B'],
        ['Question B', 'Question C'],
      ),
    ).toEqual(['Question A', 'Question B', 'Question C']);
  });

  it('questionsRequireAnswerRemap is false when only appending', () => {
    expect(
      questionsRequireAnswerRemap(
        ['Question A', 'Question B'],
        ['Question A', 'Question B', 'Question C'],
      ),
    ).toBe(false);
  });

  it('questionsRequireAnswerRemap is true when an existing question changes', () => {
    expect(
      questionsRequireAnswerRemap(
        ['Question A', 'Question B'],
        ['Question A', 'Updated Question B'],
      ),
    ).toBe(true);
  });

  it('parseRowOtherFields handles lowercase postgres column names', () => {
    expect(
      parseRowOtherFields({
        otherfields: { inferred_salary: '15L' },
      }),
    ).toEqual({ inferred_salary: '15L' });
  });

  it('buildOtherFieldsFromLegacyRows converts SQL rows', () => {
    expect(
      buildOtherFieldsFromLegacyRows([
        { fieldName: 'inferred_salary', value: '15L' },
        { fieldName: 'notice_period', value: '30 days' },
      ]),
    ).toEqual({
      inferred_salary: '15L',
      notice_period: '30 days',
    });
  });

  it('isJsonColumnEmpty treats null and empty objects as empty', () => {
    expect(isJsonColumnEmpty(null)).toBe(true);
    expect(isJsonColumnEmpty('{}')).toBe(true);
    expect(isJsonColumnEmpty({ inferred_salary: '10L' })).toBe(false);
  });
});
