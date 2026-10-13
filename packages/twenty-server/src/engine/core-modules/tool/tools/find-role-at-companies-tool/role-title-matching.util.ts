import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';

// A title with one of these does not hold the role itself
const DISQUALIFYING_PREFIX =
  /\b(assistant|associate|former|ex|past|executive assistant|secretary|pa)\b(?=\s+(to|of)\b)|\b(former|ex|past)[\s-]/i;
const LOWER_RANK_WORD = /\b(deputy|vice|assistant|associate|acting|interim)\b/i;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const titleContainsWord = (title: string, word: string): boolean =>
  word.trim() !== '' &&
  new RegExp(`(^|[^a-z0-9])${escapeRegex(word.trim().toLowerCase())}($|[^a-z0-9])`).test(
    title.toLowerCase(),
  );

// 2 = holds the role, 1 = a deputy / vice / acting version of it, 0 = no.
// The taxonomy decides what counts as the same role. A title it cannot
// classify ("Owner") still counts when it contains the role as typed.
export const scoreRoleMatch = ({
  title,
  roles,
  requestedClasses,
  candidateClass,
}: {
  title: string;
  roles: string[];
  requestedClasses: TitleClass[];
  candidateClass: TitleClass | null;
}): 0 | 1 | 2 => {
  if (title.trim() === '' || DISQUALIFYING_PREFIX.test(title)) {
    return 0;
  }

  const sameClass =
    candidateClass !== null &&
    requestedClasses.some(
      (requested) =>
        requested.functionId === candidateClass.functionId &&
        (requested.grade === null || requested.grade === candidateClass.grade),
    );
  const containsTypedRole = roles.some((role) => titleContainsWord(title, role));

  if (!sameClass && !containsTypedRole) {
    return 0;
  }

  return LOWER_RANK_WORD.test(title) ? 1 : 2;
};

// Position of the first requested role the title contains; the roles come in
// the order the user gave them, so this orders people by what they asked for first
export const getRequestedRoleOrder = (title: string, roles: string[]): number => {
  const index = roles.findIndex((role) => titleContainsWord(title, role));

  return index === -1 ? roles.length : index;
};
