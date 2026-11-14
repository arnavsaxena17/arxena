export type OutreachPersonaScoreInput = {
  connectionDegree?: number | null;
  hasWarmPath?: boolean;
  stdFunctionMatch?: boolean;
  stdGradeMatch?: boolean;
  titleSeniorityScore?: number | null; // 0–1
};

export type OutreachPersonaEnrollDecision = {
  score: number;
  enroll: boolean;
  stage: 'QUEUED' | 'DEFERRED';
};

export const scorePersonaPriority = ({
  connectionDegree,
  hasWarmPath = false,
  stdFunctionMatch = false,
  stdGradeMatch = false,
  titleSeniorityScore = 0,
}: OutreachPersonaScoreInput): number => {
  let score = 0;

  if (stdFunctionMatch) {
    score += 40;
  }

  if (stdGradeMatch) {
    score += 25;
  }

  if (connectionDegree === 1) {
    score += 20;
  } else if (connectionDegree === 2) {
    score += 10;
  } else if (connectionDegree === 3) {
    score += 4;
  }

  if (hasWarmPath) {
    score += 15;
  }

  const seniority = Math.min(1, Math.max(0, titleSeniorityScore ?? 0));

  score += seniority * 10;

  return Math.round(score * 100) / 100;
};

export const decidePersonaEnrollment = ({
  personas,
  maxPersonasPerCompany = 2,
}: {
  personas: Array<{ id: string; score: number }>;
  maxPersonasPerCompany?: number;
}): Map<string, OutreachPersonaEnrollDecision> => {
  const cap = Math.max(0, maxPersonasPerCompany);
  const sorted = [...personas].sort((left, right) => right.score - left.score);
  const decisions = new Map<string, OutreachPersonaEnrollDecision>();

  sorted.forEach((persona, index) => {
    const enroll = index < cap;

    decisions.set(persona.id, {
      score: persona.score,
      enroll,
      stage: enroll ? 'QUEUED' : 'DEFERRED',
    });
  });

  return decisions;
};
