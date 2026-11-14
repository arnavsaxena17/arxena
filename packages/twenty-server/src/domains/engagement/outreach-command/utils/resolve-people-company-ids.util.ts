const LEGAL_SUFFIXES = new Set([
  'pvt',
  'private',
  'ltd',
  'limited',
  'inc',
  'llc',
  'llp',
  'corp',
  'corporation',
  'co',
  'company',
  'india',
]);

export const toCompanyNameKey = (name: string | undefined): string =>
  (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word !== '' && !LEGAL_SUFFIXES.has(word))
    .join(' ');

type CompanyRef = { id: string; name: string };

// Employer names on profiles rarely match the Companies tab exactly
// ("Monginis Foods Pvt. Ltd." vs "Monginis"), so after legal suffixes are
// dropped a name matches exactly, or when exactly one company's name is a
// whole-word prefix of the employer, or the employer is a whole-word prefix
// of the company's name ("Subway" on the profile, "Subway South Asia" on the
// tab). Ambiguous matches are left unlinked.
export const resolvePeopleCompanyIds = <
  TPerson extends { companyId?: string; companyName?: string },
>(
  people: TPerson[],
  companies: CompanyRef[],
): TPerson[] => {
  const keyed = companies
    .map((company) => ({ id: company.id, key: toCompanyNameKey(company.name) }))
    .filter((company) => company.key !== '');

  if (keyed.length === 0) {
    return people;
  }

  return people.map((person) => {
    if ((person.companyId ?? '') !== '') {
      return person;
    }

    const employerKey = toCompanyNameKey(person.companyName);

    if (employerKey === '') {
      return person;
    }

    const exact = keyed.filter((company) => company.key === employerKey);
    const companyNameIsPrefix = keyed.filter((company) =>
      `${employerKey} `.startsWith(`${company.key} `),
    );
    const employerIsPrefix = keyed.filter((company) =>
      `${company.key} `.startsWith(`${employerKey} `),
    );
    const candidates = [exact, companyNameIsPrefix, employerIsPrefix].find(
      (group) => group.length > 0,
    );

    return candidates?.length === 1
      ? { ...person, companyId: candidates[0].id }
      : person;
  });
};
