const LEGAL_SUFFIXES = new Set([
  'ltd',
  'limited',
  'pvt',
  'private',
  'inc',
  'incorporated',
  'llc',
  'llp',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'gmbh',
  'sa',
  'ag',
]);

const toNameTokens = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !LEGAL_SUFFIXES.has(token));

// The wanted name, minus legal suffixes, must open the candidate's name:
// "Trident Group" keeps "Trident Group India" and drops "Trident Hotels".
// Words alone cannot split "Raymond" from "Raymond James"; Harvest's ranking
// and the first-match rule decide that one.
export const isHarvestCompanyNameMatch = (
  wanted: string,
  candidate: string,
): boolean => {
  const wantedTokens = toNameTokens(wanted);
  const candidateTokens = toNameTokens(candidate);

  if (wantedTokens.length === 0 || candidateTokens.length === 0) {
    return false;
  }

  // Extra words on the wanted side ("Raymond James" for "Raymond") name a
  // different firm; extra words on the candidate side are a region or unit
  if (wantedTokens.length > candidateTokens.length) {
    return false;
  }

  return wantedTokens.every((token, index) => candidateTokens[index] === token);
};
