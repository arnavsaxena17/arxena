const HONORIFICS = new Set([
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'shri',
  'smt',
  'sri',
  'prof',
]);

const nameTokens = (name: string): string[] =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token !== '' && !HONORIFICS.has(token));

// Two names refer to the same person when every word of the shorter one is in
// the longer one ("Vikesh Shah" in "Vikesh Shah - 99 Pancakes"). A single word
// never matches: a first name alone does not identify anyone.
export const personNamesMatch = (first: string, second: string): boolean => {
  const firstTokens = nameTokens(first);
  const secondTokens = nameTokens(second);
  const [shorter, longer] =
    firstTokens.length <= secondTokens.length
      ? [firstTokens, secondTokens]
      : [secondTokens, firstTokens];

  return (
    shorter.length >= 2 && shorter.every((token) => longer.includes(token))
  );
};

const tokensClose = (first: string, second: string): boolean => {
  if (first === second) {
    return true;
  }

  // one letter off in a long word: Krishna / Krishan, Shivam / Shivom
  if (first.length < 5 || second.length < 5) {
    return false;
  }

  if (first.length === second.length) {
    let differences = 0;

    for (let index = 0; index < first.length; index += 1) {
      if (first[index] !== second[index]) {
        differences += 1;
      }
    }

    // a swap of two neighbouring letters counts as one slip
    return (
      differences <= 1 ||
      (differences === 2 &&
        [...first].some(
          (letter, index) =>
            letter !== second[index] &&
            letter === second[index + 1] &&
            first[index + 1] === second[index],
        ))
    );
  }

  const [shorter, longer] =
    first.length < second.length ? [first, second] : [second, first];

  if (longer.length - shorter.length !== 1) {
    return false;
  }

  return [...longer].some(
    (_, index) => longer.slice(0, index) + longer.slice(index + 1) === shorter,
  );
};

// personNamesMatch that also forgives a one-letter spelling slip in a word of
// five letters or more, for two rows that look like one person
export const personNamesRoughlyMatch = (
  first: string,
  second: string,
): boolean => {
  const firstTokens = nameTokens(first);
  const secondTokens = nameTokens(second);
  const [shorter, longer] =
    firstTokens.length <= secondTokens.length
      ? [firstTokens, secondTokens]
      : [secondTokens, firstTokens];

  return (
    shorter.length >= 2 &&
    shorter.every((token) =>
      longer.some((candidate) => tokensClose(token, candidate)),
    )
  );
};
