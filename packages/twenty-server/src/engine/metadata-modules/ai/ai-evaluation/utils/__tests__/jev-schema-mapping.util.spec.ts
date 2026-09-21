import {
  canUseJevForFilterFields,
  isDecisionOnlyAgentSchema,
  isJevCompatibleFilterField,
  mapAgentSchemaToJevQuestions,
  mapFilterFieldsToJevQuestions,
} from 'src/engine/metadata-modules/ai/ai-evaluation/utils/map-decision-schema-to-jev-questions.util';
import { mapJevAnswersToRecord } from 'src/engine/metadata-modules/ai/ai-evaluation/utils/map-jev-answers-to-record.util';
import { isJevModelId } from 'src/engine/metadata-modules/ai/ai-evaluation/utils/is-jev-model-id.util';

describe('isJevModelId', () => {
  it('should match known Jev aliases', () => {
    expect(isJevModelId('typesafe-ai/jev')).toBe(true);
    expect(isJevModelId('jev')).toBe(true);
    expect(isJevModelId('typesafe/jev-1.13')).toBe(true);
    expect(isJevModelId('openrouter/typesafe/jev-1.13')).toBe(true);
  });

  it('should reject chat models', () => {
    expect(isJevModelId('openai/gpt-4o')).toBe(false);
    expect(isJevModelId(undefined)).toBe(false);
  });
});

describe('mapDecisionSchemaToJevQuestions', () => {
  it('should map boolean and enum filter fields', () => {
    expect(
      canUseJevForFilterFields([
        { name: 'isFit', type: 'boolean', description: 'Is a fit?' },
        {
          name: 'seniority',
          type: 'enum',
          enumValues: ['junior', 'senior'],
        },
      ]),
    ).toBe(true);

    expect(isJevCompatibleFilterField({ name: 'notes', type: 'text' })).toBe(
      false,
    );

    const questions = mapFilterFieldsToJevQuestions(
      [
        { name: 'isFit', type: 'boolean', description: 'Is a fit?' },
        {
          name: 'seniority',
          type: 'enum',
          enumValues: ['junior', 'senior'],
        },
      ],
      'Evaluate the candidate.',
    );

    expect(questions.isFit).toEqual({
      type: 'boolean',
      instructions: 'Is a fit?',
    });
    expect(questions.seniority).toEqual({
      type: 'choice',
      instructions:
        'Evaluate the candidate.\n\nDecide the value for "seniority".',
      criteria: { junior: 'junior', senior: 'senior' },
    });
  });

  it('should map decision-only agent schemas', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        matches: { type: 'boolean' as const, description: 'Matches ICP?' },
        score: { type: 'number' as const },
      },
      additionalProperties: false as const,
    };

    expect(isDecisionOnlyAgentSchema(schema)).toBe(true);
    expect(
      isDecisionOnlyAgentSchema({
        type: 'object',
        properties: { message: { type: 'string' } },
      }),
    ).toBe(false);

    const questions = mapAgentSchemaToJevQuestions(schema, 'From tools');

    expect(questions.matches?.type).toBe('boolean');
    expect(questions.score?.type).toBe('score');
  });
});

describe('mapJevAnswersToRecord', () => {
  it('should map boolean, choice, and score answers', () => {
    expect(
      mapJevAnswersToRecord({
        matches: { type: 'boolean', probability: 0.9 },
        route: {
          type: 'choice',
          choice: 'billing',
          probabilities: { billing: 1, shipping: 0 },
        },
        quality: {
          type: 'score',
          score: 7.2,
          probabilities: { '7': 0.8, '8': 0.2 },
        },
      }),
    ).toEqual({
      matches: true,
      route: 'billing',
      quality: 7.2,
    });
  });

  it('should respect boolean threshold', () => {
    expect(
      mapJevAnswersToRecord(
        { matches: { type: 'boolean', probability: 0.4 } },
        { booleanProbabilityThreshold: 0.5 },
      ),
    ).toEqual({ matches: false });
  });
});
