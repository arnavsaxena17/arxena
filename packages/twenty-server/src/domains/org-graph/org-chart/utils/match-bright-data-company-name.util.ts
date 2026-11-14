const LEGAL_SUFFIXES =
  /\b(inc|incorporated|llc|ltd|limited|pvt|private|plc|corp|corporation|co|company|gmbh|sa|ag|llp)\b\.?/g;

export const normalizeCompanyName = (value: string): string =>
  value
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Bright Data people and company records share no id, so the company name is
// the only join. Exact match after dropping legal suffixes rejects "Acme"
// matching "Acme Robotics" while still accepting "Acme Inc".
export const matchesBrightDataCompanyName = (
  expectedCompanyName: string,
  candidateCompanyName: unknown,
): boolean => {
  if (typeof candidateCompanyName !== 'string') {
    return false;
  }

  const expected = normalizeCompanyName(expectedCompanyName);

  return (
    expected !== '' && expected === normalizeCompanyName(candidateCompanyName)
  );
};
