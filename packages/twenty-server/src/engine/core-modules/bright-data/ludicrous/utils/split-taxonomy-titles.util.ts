import { type BrightDataLudicrousRubric } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';

const compilePatterns = (patterns: string[]): RegExp[] =>
  patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern, 'i');
      } catch {
        return null;
      }
    })
    .filter((pattern): pattern is RegExp => pattern !== null);

const PLAIN_WORDS = /^[a-z][a-z -]*$/i;

export type TaxonomyTitleSplit = {
  // Added titles that keep the specialty ("senior consultant nephrologist"):
  // they join the slice as they are
  specific: string[];
  // Added titles that drop it ("consultant physician"): only a profile that
  // names the specialty makes them a match, so they get their own slice
  generic: string[];
  // Added titles the slice itself rules out ("physician assistant" when
  // assistant is excluded)
  excluded: string[];
};

// The job-title taxonomy expands a title to its class, and a class can be
// wider than what was asked: nephrologist sits in a general physician class,
// so its "similar titles" are any physician. The planner's rubric already says
// what a match looks like (titleIncludePatterns), so an added title is kept
// only when it still matches that, and the rest are set aside for a slice that
// asks the profile text for the specialty instead.
export const splitTaxonomyTitles = ({
  added,
  rubric,
  excludeTitleWords,
}: {
  added: string[];
  rubric: Pick<
    BrightDataLudicrousRubric,
    'titleIncludePatterns' | 'titleExcludePatterns'
  >;
  excludeTitleWords: string[];
}): TaxonomyTitleSplit => {
  const includes = compilePatterns(rubric.titleIncludePatterns);
  const excludes = compilePatterns(rubric.titleExcludePatterns);
  const excludedWords = excludeTitleWords
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0);
  const split: TaxonomyTitleSplit = { specific: [], generic: [], excluded: [] };

  for (const title of added) {
    const words = title.toLowerCase().split(/\s+/);

    if (
      excludes.some((pattern) => pattern.test(title)) ||
      excludedWords.some((word) => words.includes(word))
    ) {
      split.excluded.push(title);
    } else if (
      includes.length === 0 ||
      includes.some((pattern) => pattern.test(title))
    ) {
      split.specific.push(title);
    } else {
      split.generic.push(title);
    }
  }

  return split;
};

// The words that name the specialty, for a profile-text search: the rubric's
// plain-word patterns ("nephrology") and the typed title words they match
// ("nephrologist"). Regex-shaped patterns are skipped; they are not words a
// profile contains.
export const specialtyPhrasesFor = ({
  typedTitles,
  rubric,
}: {
  typedTitles: string[];
  rubric: Pick<BrightDataLudicrousRubric, 'titleIncludePatterns'>;
}): string[] => {
  const includes = compilePatterns(rubric.titleIncludePatterns);
  const fromPatterns = rubric.titleIncludePatterns
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => PLAIN_WORDS.test(pattern));
  const fromTitles = typedTitles
    .flatMap((title) => title.toLowerCase().split(/\s+/))
    .filter(
      (word) =>
        word.length > 2 && includes.some((pattern) => pattern.test(word)),
    );

  const candidates = [...new Set([...fromPatterns, ...fromTitles])];

  // A regex stem ("nephrolog") is not a word a profile contains; the fuller
  // words it prefixes ("nephrology", "nephrologist") are
  return candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) => other !== candidate && other.startsWith(candidate),
      ),
  );
};
