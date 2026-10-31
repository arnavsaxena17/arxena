import { isNonEmptyString } from '@sniptt/guards';

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

// Words that join a designation but say nothing about which role it is
const FILLER_WORDS = new Set(['of', 'the', 'and', 'for', 'to', 'in', '&']);

const contentWordsOf = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter((word) => word.length > 1 && !FILLER_WORDS.has(word));

// "Head of Procurement" holds "Procurement Head": the same words in another
// order. Needs two words, so a bare "Head" never matches every head.
const titleHasEveryWordOf = (title: string, form: string): boolean => {
  const formWords = contentWordsOf(form);

  return (
    formWords.length >= 2 &&
    formWords.every((word) => titleContainsWord(title, word))
  );
};

const titleHoldsRole = (
  title: string,
  role: string,
  { useFamilyFallback }: { useFamilyFallback: boolean },
): boolean =>
  [
    ...expandRole(role),
    ...(useFamilyFallback ? expandRoleWithFamilyFallback(role) : []),
  ]
    .filter((form, index, forms) => forms.indexOf(form) === index)
    .some(
      (form) =>
        titleContainsWord(title, form) || titleHasEveryWordOf(title, form),
    );

// Grade words are shared by every role, so they cannot tell two roles apart
const GRADE_WORDS = new Set([
  'head',
  'chief',
  'officer',
  'vp',
  'vice',
  'president',
  'director',
  'manager',
  'gm',
  'general',
  'lead',
  'leader',
  'senior',
  'global',
  'group',
  'national',
  'regional',
]);

// The requested role a title is closest to, for a person the judge kept whose
// title matched no role as written. Shared function words decide; a tie goes
// to the role whose query found the person, then to the first role. Before
// this every such person was filed under the first role, so a second role
// ("Procurement Head" after "Head of Supply Chain") could never be filled.
export const closestRequestedRole = (
  title: string,
  roles: string[],
  queriedRole?: string,
): string | undefined => {
  if (roles.length === 0) {
    return undefined;
  }

  const titleWords = new Set(
    contentWordsOf(title).filter((word) => !GRADE_WORDS.has(word)),
  );
  const overlapOf = (role: string): number =>
    contentWordsOf(role).filter(
      (word) => !GRADE_WORDS.has(word) && titleWords.has(word),
    ).length;
  const best = Math.max(...roles.map(overlapOf));
  const tied = roles.filter((role) => overlapOf(role) === best);
  const queried = tied.find(
    (role) =>
      isNonEmptyString(queriedRole) &&
      role.trim().toLowerCase() === queriedRole.trim().toLowerCase(),
  );

  return queried ?? tied[0];
};

export const titleContainsWord = (title: string, word: string): boolean =>
  word.trim() !== '' &&
  new RegExp(
    `(^|[^a-z0-9])${escapeRegex(word.trim().toLowerCase())}($|[^a-z0-9])`,
  ).test(title.toLowerCase());

// 2 = holds the role, 1 = a related version of it (a deputy / vice / acting
// holder, or a sibling function under the same root), 0 = no.
// The taxonomy decides what counts as the same role. A title it cannot
// classify ("Owner") still counts when it contains the role as typed.
export const scoreRoleMatch = ({
  title,
  roles,
  requestedClasses,
  candidateClass,
  scope = 'role',
}: {
  title: string;
  roles: string[];
  requestedClasses: TitleClass[];
  candidateClass: TitleClass | null;
  scope?: 'role' | 'family';
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
  // A sibling function under the same root is a related role only in family
  // (department/coverage) scope: "Head of Logistics" for a supply chain
  // family request. In role scope it is a different role and must be rejected,
  // otherwise one conjoined phrase hides a whole function. A same-function
  // title at the wrong grade is still a mismatch, not a sibling.
  // A child function is relevant when the user named it ("Head of Supply Chain
  // & Logistics") or when the request is explicitly a family/coverage one.
  const mentionsSiblingFunction =
    candidateClass !== null &&
    roles.some((role) => titleContainsWord(role, candidateClass.functionId));
  const sameRootSibling =
    (scope === 'family' || mentionsSiblingFunction) &&
    candidateClass !== null &&
    candidateClass.functionRoot !== null &&
    requestedClasses.some(
      (requested) =>
        requested.functionRoot !== null &&
        requested.functionRoot === candidateClass.functionRoot &&
        requested.functionId !== candidateClass.functionId,
    );
  // Role scope uses the curated equivalents even when the taxonomy answered:
  // manufacturing -> operations head is a business equivalence the truth tree
  // cannot infer, and the table no longer carries supply chain -> logistics.
  const useFamilyFallback = scope === 'role' || requestedClasses.length === 0;
  const containsTypedRole = roles.some((role) =>
    titleHoldsRole(title, role, { useFamilyFallback }),
  );

  if (!sameClass && !sameRootSibling && !containsTypedRole) {
    return 0;
  }

  if (!sameClass && sameRootSibling) {
    return 1;
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

const LEADERSHIP_TITLE =
  /\b(head|chief|cxo|ceo|cfo|coo|cto|cmo|cpo|chro|cso|vp|svp|evp|avp|vice president|president|director|gm|general manager|md|managing director|founder|owner|partner|leader|lead)\b/i;
const JUNIOR_TITLE =
  /\b(assistant|associate|junior|jr|trainee|intern|executive|analyst|coordinator|specialist|officer|manager|engineer|supervisor|consultant)\b/i;
const SENIOR_MANAGER = /\bsenior\s+manager\b/i;

// Worth a paid lookup only when the title could be the role holder. A plain
// manager, executive or analyst is never the head of a function, and each one
// used to cost a name search on two sources before the judge rejected it.
// An empty title is not known to be junior, so it still gets looked up.
export const isLeadershipCandidateTitle = (title: string): boolean => {
  const trimmed = title.trim();

  if (trimmed === '' || LEADERSHIP_TITLE.test(trimmed)) {
    return true;
  }

  return SENIOR_MANAGER.test(trimmed) || !JUNIOR_TITLE.test(trimmed);
};
