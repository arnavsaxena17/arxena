// A user can name two functions in one breath: "Head of Supply Chain /
// Logistics", "Procurement & Logistics Head". Passing that phrase through as
// one role is lossy: the taxonomy files one title under one function, so the
// other function is never searched and a person who holds it is rejected.
//
// This splits a coordinated mention into one role per function. It is a string
// transform only; the caller classifies the parts and keeps the split only when
// the parts really are different functions, so a compound like
// "Research & Development" survives intact.

// Coordinators are only split on a separator between two designation-like
// fragments. The lookarounds keep "M&A" and "S&OP" in one piece for the guards
// below to recognise.
const COORDINATOR = /\s*(?:\/|&|\+|\|)\s*|\s+\b(?:and|or)\b\s+/i;

// A coordinated phrase that is one function, not two. Kept as a word list
// because these are the compounds a title splitter otherwise breaks.
const COMPOUND_MENTION =
  /\b(?:r\s*&\s*d|research\s*(?:&|and)\s*development|h\s*&\s*s|health\s*(?:,|&|and)\s*safety|health\s*,?\s*safety\s*(?:&|and)\s*environment|mergers?\s*(?:&|and)\s*acquisitions?|s\s*&\s*op|sales\s*(?:&|and)\s*operations\s*planning|m\s*&\s*e|monitoring\s*(?:&|and)\s*evaluation|l\s*&\s*d|learning\s*(?:&|and)\s*development|d\s*&\s*i|diversity\s*(?:&|and)\s*inclusion|ehs|hse|p\s*&\s*l|p\s*&\s*d)\b/i;

// The grade word that a coordinated phrase can share: "Supply Chain /
// Logistics Head" means two heads, not one head of both.
const SHARED_TAIL =
  /\s+(heads?|leads?|leader|directors?|vps?|svps?|evps?|avps?|chief|officers?|managers?|gms?|presidents?)$/i;

// The shared prefix: "Head of Supply Chain / Logistics" means a head of each,
// not a head of the pair.
const SHARED_PREFIX = /^(.*?\b(?:of|for))\s+(.+)$/i;

// "VP Sales & Marketing", "Global Head Supply Chain / Logistics": the grade
// word leads the first function and belongs to all of them
const LEADING_GRADE =
  /^((?:(?:senior|global|regional|national|group|associate|deputy|executive|vice|assistant|interim|acting)\s+)*(?:vps?|svps?|evps?|avps?|heads?|directors?|chief|managers?|gms?|presidents?))\s+(.+)$/i;

const HAS_COORDINATOR = /\/|&|\+|\||\b(?:and|or)\b/i;

// A part that is already a whole designation, so no shared head applies
const STANDALONE_DESIGNATION =
  /^(?:ceo|cfo|coo|cto|cmo|chro|cpo|md|vp|svp|evp|avp|gm|president|founder|owner)$/i;

const splitOnCoordinator = (value: string): string[] =>
  value
    .split(COORDINATOR)
    .map((part) => part.trim())
    .filter((part) => part !== '');

const endsWithWord = (value: string, word: string): boolean =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(
    value.trim(),
  );

// The grade word a coordinated phrase can share, either leading ("VP Sales &
// Marketing") or trailing ("Supply Chain / Logistics Head")
const sharedPrefixOf = (value: string): { prefix: string; body: string } => {
  const ofMatch = value.match(SHARED_PREFIX);

  if (ofMatch !== null && HAS_COORDINATOR.test(ofMatch[2] ?? '')) {
    return { prefix: ofMatch[1].trim(), body: ofMatch[2] };
  }

  const gradeMatch = value.match(LEADING_GRADE);

  if (gradeMatch !== null && HAS_COORDINATOR.test(gradeMatch[2] ?? '')) {
    return { prefix: gradeMatch[1].trim(), body: gradeMatch[2] };
  }

  return { prefix: '', body: value };
};

// One mention in, the roles it names out. A mention without a coordinator, or a
// known compound, comes back unchanged.
export const splitRoleMention = (mention: string): string[] => {
  const normalized = mention.trim().replace(/\s+/g, ' ');

  if (normalized === '' || COMPOUND_MENTION.test(normalized)) {
    return [mention];
  }

  if (!HAS_COORDINATOR.test(normalized)) {
    return [mention];
  }

  const { prefix, body } = sharedPrefixOf(normalized);
  const parts = splitOnCoordinator(body);

  if (parts.length < 2) {
    return [mention];
  }

  // "Chief of Staff / CEO" is not a shared head: the second part is a whole
  // designation already. Prefixing it would invent "Chief of CEO", so the
  // mention is left alone and the taxonomy reads it as one title.
  if (
    prefix !== '' &&
    parts.some((part) => STANDALONE_DESIGNATION.test(part.trim()))
  ) {
    return [mention];
  }

  // "Supply Chain / Logistics Head": the grade word on the last part belongs to
  // every part
  const lastPart = parts[parts.length - 1];
  const tailMatch = lastPart.match(SHARED_TAIL);
  const sharedTail = tailMatch?.[1] ?? '';
  const bareParts =
    sharedTail === ''
      ? parts
      : [
          ...parts.slice(0, -1),
          lastPart.slice(0, lastPart.length - sharedTail.length).trim(),
        ];

  const rebuilt = bareParts
    .map((part) => {
      const trimmed = part.trim();

      if (trimmed === '') {
        return '';
      }

      const withPrefix = prefix === '' ? trimmed : `${prefix} ${trimmed}`;

      if (sharedTail === '' || endsWithWord(withPrefix, sharedTail)) {
        return withPrefix;
      }

      return `${withPrefix} ${sharedTail}`;
    })
    .filter((part) => part !== '');

  if (rebuilt.length < 2) {
    return [mention];
  }

  return [...new Set(rebuilt)];
};

// A query term from a role or title. A coordinated mention becomes one term per
// part, and quote, bracket and slash characters are dropped: quoted inside a
// Google OR group, "Head of Supply Chain / Logistics" returned no results at all.
export const toSearchTerms = (terms: string[]): string[] => {
  const seen = new Set<string>();
  const searchTerms: string[] = [];

  for (const term of terms) {
    for (const part of splitRoleMention(term)) {
      const cleaned = part
        .replace(/["“”()[\]{}]/g, ' ')
        .replace(/\s*[/|\\]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const key = cleaned.toLowerCase();

      if (cleaned === '' || seen.has(key)) {
        continue;
      }

      seen.add(key);
      searchTerms.push(cleaned);
    }
  }

  return searchTerms;
};
