import { type GtmPersonRow } from '@/gtm-home/types/gtm-home.types';

export type GtmPersonaScoreInput = {
  connectionDegree?: number | null;
  hasWarmPath?: boolean;
  stdFunctionMatch?: boolean;
  stdGradeMatch?: boolean;
  titleSeniorityScore?: number | null;
};

export const scorePersonaPriority = ({
  connectionDegree,
  hasWarmPath = false,
  stdFunctionMatch = false,
  stdGradeMatch = false,
  titleSeniorityScore = 0,
}: GtmPersonaScoreInput): number => {
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

export const applyMaxPersonasPerCompany = ({
  people,
  maxPersonasPerCompany = 2,
}: {
  people: GtmPersonRow[];
  maxPersonasPerCompany?: number;
}): GtmPersonRow[] => {
  const byCompany = people.reduce<Record<string, GtmPersonRow[]>>(
    (accumulator, person) => {
      const key = person.companyId;
      const existing = accumulator[key] ?? [];

      existing.push(person);
      accumulator[key] = existing;

      return accumulator;
    },
    {},
  );

  const result: GtmPersonRow[] = [];

  Object.values(byCompany).forEach((companyPeople) => {
    const scored = companyPeople
      .map((person) => {
        const hasWarmPath = person.warmPath !== '—' && person.warmPath !== '';
        const score =
          person.personaPriorityScore ??
          scorePersonaPriority({
            connectionDegree: person.connectionDegree ?? null,
            hasWarmPath,
            stdFunctionMatch: true,
            stdGradeMatch: /vp|head|director/i.test(person.title),
            titleSeniorityScore: /vp|head/i.test(person.title)
              ? 1
              : /director/i.test(person.title)
                ? 0.7
                : 0.4,
          });

        return { person, score };
      })
      .sort((left, right) => right.score - left.score);

    scored.forEach((entry, index) => {
      result.push({
        ...entry.person,
        personaPriorityScore: entry.score,
        stage: index < maxPersonasPerCompany ? 'queued' : 'deferred',
      });
    });
  });

  return result;
};
