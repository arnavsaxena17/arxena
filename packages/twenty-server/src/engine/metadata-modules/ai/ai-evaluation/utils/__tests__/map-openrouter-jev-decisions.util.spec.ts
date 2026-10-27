import {
  fromOpenRouterAnswers,
  toOpenRouterQuestions,
} from 'src/engine/metadata-modules/ai/ai-evaluation/utils/map-openrouter-jev-decisions.util';

describe('map-openrouter-jev-decisions', () => {
  it('should map boolean questions to noul and noul answers back to boolean', () => {
    expect(
      toOpenRouterQuestions({
        isFit: {
          type: 'boolean',
          instructions: 'Is this person a fit?',
        },
        seniority: {
          type: 'choice',
          instructions: 'Pick seniority',
          criteria: { junior: 'junior', senior: 'senior' },
        },
      }),
    ).toEqual({
      isFit: {
        type: 'noul',
        instructions: 'Is this person a fit?',
        criteria: { true: 'true', false: 'false' },
      },
      seniority: {
        type: 'choice',
        instructions: 'Pick seniority',
        criteria: { junior: 'junior', senior: 'senior' },
      },
    });

    expect(
      fromOpenRouterAnswers({
        isFit: { type: 'noul', noul: 0.82 },
        seniority: { type: 'choice', choice: 'senior' },
      }),
    ).toEqual({
      isFit: { type: 'boolean', probability: 0.82 },
      seniority: {
        type: 'choice',
        choice: 'senior',
        probabilities: {},
      },
    });
  });
});
