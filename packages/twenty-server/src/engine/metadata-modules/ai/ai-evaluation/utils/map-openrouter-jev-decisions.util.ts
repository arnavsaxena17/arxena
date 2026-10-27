import { isDefined } from 'twenty-shared/utils';

import {
  type JevAnswer,
  type JevAnswers,
  type JevQuestion,
  type JevQuestions,
} from 'src/engine/metadata-modules/ai/ai-evaluation/types/jev-evaluation.type';

// OpenRouter decisions uses noul instead of boolean
export type OpenRouterDecisionQuestion =
  | {
      type: 'noul';
      instructions: string;
      criteria: { true: string; false: string };
    }
  | {
      type: 'choice';
      instructions: string;
      criteria: Record<string, string>;
    }
  | {
      type: 'score';
      instructions: string;
      criteria: string[];
    };

export type OpenRouterDecisionAnswer = {
  type?: string;
  noul?: number;
  choice?: string;
  score?: number;
  probability?: number;
  probabilities?: Record<string, number>;
};

const DEFAULT_NOUL_CRITERIA = {
  true: 'true',
  false: 'false',
} as const;

export const toOpenRouterQuestion = (
  question: JevQuestion,
): OpenRouterDecisionQuestion => {
  if (question.type === 'boolean') {
    return {
      type: 'noul',
      instructions: question.instructions,
      criteria: question.criteria ?? DEFAULT_NOUL_CRITERIA,
    };
  }

  return question;
};

export const toOpenRouterQuestions = (
  questions: JevQuestions,
): Record<string, OpenRouterDecisionQuestion> =>
  Object.fromEntries(
    Object.entries(questions).map(([questionId, question]) => [
      questionId,
      toOpenRouterQuestion(question),
    ]),
  );

export const fromOpenRouterAnswer = (
  answer: OpenRouterDecisionAnswer,
): JevAnswer | null => {
  if (answer.type === 'noul' && typeof answer.noul === 'number') {
    return { type: 'boolean', probability: answer.noul };
  }

  if (answer.type === 'boolean' && typeof answer.probability === 'number') {
    return { type: 'boolean', probability: answer.probability };
  }

  if (answer.type === 'choice' && typeof answer.choice === 'string') {
    return {
      type: 'choice',
      choice: answer.choice,
      probabilities: answer.probabilities ?? {},
    };
  }

  if (answer.type === 'score' && typeof answer.score === 'number') {
    return {
      type: 'score',
      score: answer.score,
      probabilities: answer.probabilities ?? {},
    };
  }

  return null;
};

export const fromOpenRouterAnswers = (
  answers: Record<string, OpenRouterDecisionAnswer>,
): JevAnswers => {
  const mapped: JevAnswers = {};

  for (const [questionId, answer] of Object.entries(answers)) {
    const mappedAnswer = fromOpenRouterAnswer(answer);

    if (isDefined(mappedAnswer)) {
      mapped[questionId] = mappedAnswer;
    }
  }

  return mapped;
};
