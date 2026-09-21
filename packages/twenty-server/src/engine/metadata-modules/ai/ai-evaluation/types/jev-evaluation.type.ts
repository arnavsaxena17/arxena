export type JevBooleanQuestion = {
  type: 'boolean';
  instructions: string;
  criteria?: {
    true: string;
    false: string;
  };
};

export type JevChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};

export type JevScoreQuestion = {
  type: 'score';
  instructions: string;
  criteria: string[];
};

export type JevQuestion =
  | JevBooleanQuestion
  | JevChoiceQuestion
  | JevScoreQuestion;

export type JevQuestions = Record<string, JevQuestion>;

export type JevBooleanAnswer = {
  type: 'boolean';
  probability: number;
};

export type JevChoiceAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
};

export type JevScoreAnswer = {
  type: 'score';
  score: number;
  probabilities: Record<string, number>;
};

export type JevAnswer = JevBooleanAnswer | JevChoiceAnswer | JevScoreAnswer;

export type JevAnswers = Record<string, JevAnswer>;

export type JevEvaluateRequest = {
  model: string;
  state: string | Record<string, unknown> | unknown[];
  questions: JevQuestions;
};

export type JevEvaluateResponse = {
  model: string;
  answers: JevAnswers;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};
