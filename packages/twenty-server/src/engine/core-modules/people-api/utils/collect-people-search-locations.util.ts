const uniqueTrimmed = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
};

export const collectPeopleSearchLocations = (input: {
  locations?: string[];
  country?: string;
}): string[] => uniqueTrimmed([...(input.locations ?? []), input.country]);
