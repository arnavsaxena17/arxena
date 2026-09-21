import { JEV_BOOLEAN_PROBABILITY_THRESHOLD } from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';
import {
  type JevAnswer,
  type JevAnswers,
} from 'src/engine/metadata-modules/ai/ai-evaluation/types/jev-evaluation.type';

export type MapJevAnswersOptions = {
  booleanProbabilityThreshold?: number;
};

const mapSingleAnswer = (
  answer: JevAnswer,
  booleanProbabilityThreshold: number,
): boolean | number | string | null => {
  if (answer.type === 'boolean') {
    return answer.probability >= booleanProbabilityThreshold;
  }

  if (answer.type === 'choice') {
    return answer.choice;
  }

  if (answer.type === 'score') {
    return answer.score;
  }

  return null;
};

export const mapJevAnswersToRecord = (
  answers: JevAnswers,
  options?: MapJevAnswersOptions,
): Record<string, boolean | number | string | null> => {
  const booleanProbabilityThreshold =
    options?.booleanProbabilityThreshold ?? JEV_BOOLEAN_PROBABILITY_THRESHOLD;

  return Object.fromEntries(
    Object.entries(answers).map(([fieldName, answer]) => [
      fieldName,
      mapSingleAnswer(answer, booleanProbabilityThreshold),
    ]),
  );
};
