export const normalizeOrgChartFunctionRootFilter = (
  functionRoot?: string,
): string => {
  return (functionRoot ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
};

export const hasMeaningfulOrgChartFunctionRootFilter = (
  functionRoot?: string,
): boolean => {
  const normalized = normalizeOrgChartFunctionRootFilter(functionRoot);

  return normalized.length > 0 && normalized !== 'fullcompany';
};

const readNonEmptyStringFields = (
  raw: Record<string, unknown>,
  keys: string[],
): string[] =>
  keys
    .map((key) => raw[key])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

export const candidateRowMatchesOrgChartCountryFilter = (
  raw: Record<string, unknown>,
  countryRaw: string,
): boolean => {
  const filterCountry = countryRaw.trim().toLowerCase();

  if (!filterCountry || filterCountry === 'global') {
    return true;
  }

  const candidateLocationValues = readNonEmptyStringFields(raw, [
    'locationCountry',
    'location_country',
    'country',
    'location',
    'locationName',
    'location_name',
  ]);

  if (candidateLocationValues.length === 0) {
    return false;
  }

  return candidateLocationValues.some((value) =>
    value.trim().toLowerCase().includes(filterCountry),
  );
};

export const candidateRowMatchesOrgChartFunctionRootFilter = (
  raw: Record<string, unknown>,
  functionRootRaw: string,
): boolean => {
  if (!hasMeaningfulOrgChartFunctionRootFilter(functionRootRaw)) {
    return true;
  }

  const filterFunctionRoot = functionRootRaw.trim().toLowerCase();
  const possibleFunctionRootValues = readNonEmptyStringFields(raw, [
    'std_function_root',
    'functionRoot',
    'function_root',
  ]);

  if (possibleFunctionRootValues.length === 0) {
    return false;
  }

  return possibleFunctionRootValues.some((value) =>
    value.trim().toLowerCase().includes(filterFunctionRoot),
  );
};

export const filterOrgChartCandidatesByCountryAndFunctionRoot = (
  items: unknown[],
  countryRaw?: string,
  functionRootRaw?: string,
): unknown[] => {
  const normalizedCountryRaw =
    typeof countryRaw === 'string' ? countryRaw.trim() : '';
  const hasCountryFilter =
    normalizedCountryRaw.length > 0 &&
    normalizedCountryRaw.toLowerCase() !== 'global';

  const normalizedFunctionRootRaw =
    typeof functionRootRaw === 'string' ? functionRootRaw.trim() : '';
  const hasFunctionRootFilter =
    hasMeaningfulOrgChartFunctionRootFilter(normalizedFunctionRootRaw);

  if (!hasCountryFilter && !hasFunctionRootFilter) {
    return items;
  }

  return items.filter((item) => {
    const raw = item as Record<string, unknown>;

    if (
      hasCountryFilter &&
      !candidateRowMatchesOrgChartCountryFilter(raw, normalizedCountryRaw)
    ) {
      return false;
    }

    if (
      hasFunctionRootFilter &&
      !candidateRowMatchesOrgChartFunctionRootFilter(
        raw,
        normalizedFunctionRootRaw,
      )
    ) {
      return false;
    }

    return true;
  });
};
