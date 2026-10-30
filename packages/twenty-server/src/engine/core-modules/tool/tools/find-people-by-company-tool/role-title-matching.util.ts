import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';
import { expandRoleWithFamilyFallback } from 'src/engine/core-modules/title-taxonomy/title-family-fallback.util';

// A title with one of these does not hold the role itself
const DISQUALIFYING_PREFIX =
  /\b(assistant|associate|former|ex|past|executive assistant|secretary|pa)\b(?=\s+(to|of)\b)|\b(former|ex|past)[\s-]/i;
// "CEO Office", "Office of the MD" and "Chief of Staff to the CEO" work for the
// role, they are not it
const WORKS_FOR_ROLE =
  /\b(?:ceo|md|chairman|founder|director|president)['’]?s?\s+(?:office|desk|team)\b|\boffice\s+of\s+(?:the\s+)?(?:ceo|md|chairman|founder|managing director|chief executive)\b|\bchief\s+of\s+staff\b/i;
const LOWER_RANK_WORD = /\b(deputy|vice|assistant|associate|acting|interim)\b/i;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The short forms people type and the long forms titles are written in. The
// taxonomy service decides what a role means; this covers the moment it is
// unreachable, so "MD" still finds "Group Managing Director".
const ROLE_SYNONYMS: Record<string, string[]> = {
  ceo: ['chief executive officer', 'chief executive'],
  md: ['managing director'],
  cfo: ['chief financial officer'],
  coo: ['chief operating officer'],
  cto: ['chief technology officer'],
  cmo: ['chief marketing officer'],
  chro: ['chief human resources officer'],
  cpo: ['chief product officer'],
};

const expandRole = (role: string): string[] => {
  const key = role.trim().toLowerCase();
  const spelledOut = ROLE_SYNONYMS[key] ?? [];
  const shortForms = Object.entries(ROLE_SYNONYMS)
    .filter(([, longForms]) => longForms.includes(key))
    .map(([shortForm]) => shortForm);

  return [role, ...spelledOut, ...shortForms];
};

const titleHoldsRole = (
  title: string,
  role: string,
  { useFamilyFallback }: { useFamilyFallback: boolean },
): boolean =>
  [...expandRole(role), ...(useFamilyFallback ? expandRoleWithFamilyFallback(role) : [])]
    .filter((form, index, forms) => forms.indexOf(form) === index)
    .some((form) => titleContainsWord(title, form));

export const titleContainsWord = (title: string, word: string): boolean =>
  word.trim() !== '' &&
  new RegExp(
    `(^|[^a-z0-9])${escapeRegex(word.trim().toLowerCase())}($|[^a-z0-9])`,
  ).test(title.toLowerCase());

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
  if (
    title.trim() === '' ||
    DISQUALIFYING_PREFIX.test(title) ||
    WORKS_FOR_ROLE.test(title)
  ) {
    return 0;
  }

  const sameClass =
    candidateClass !== null &&
    requestedClasses.some(
      (requested) =>
        requested.functionId === candidateClass.functionId &&
        (requested.grade === null || requested.grade === candidateClass.grade),
    );
  // With no taxonomy answer there are no curated classes to compare, so the
  // role's curated family stands in for them
  const useFamilyFallback = requestedClasses.length === 0;
  const containsTypedRole = roles.some((role) =>
    titleHoldsRole(title, role, { useFamilyFallback }),
  );

  if (!sameClass && !containsTypedRole) {
    return 0;
  }

  return LOWER_RANK_WORD.test(title) ? 1 : 2;
};

// Position of the first requested role the title contains; the roles come in
// the order the user gave them, so this orders people by what they asked for first
export const getRequestedRoleOrder = (
  title: string,
  roles: string[],
): number => {
  const index = roles.findIndex((role) =>
    titleHoldsRole(title, role, { useFamilyFallback: false }),
  );

  return index === -1 ? roles.length : index;
};
