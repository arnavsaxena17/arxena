export const PDL_AUTOCOMPLETE_SHARED_KEY_ENV_NAMES = [
  'PARAG_PDL_API_KEY',
  'ARXENACO_PDL_API_KEY',
  'RAVI_PDL_API_KEY',
] as const;

export const PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME =
  'JAWAHAR_PDL_API_KEY';

export const PDL_AUTOCOMPLETE_FALLBACK_KEY_ENV_NAME = 'PDL_API_KEY';

export type PdlAutocompleteKeySlot = {
  name: string;
  value: string;
};

export const resolvePdlAutocompleteKeyPool = (args: {
  keysByName: Record<string, string | undefined>;
  includeTwentyFrontReservedKey: boolean;
}): PdlAutocompleteKeySlot[] => {
  const reservedValue =
    args.keysByName[PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME]?.trim() ||
    undefined;

  const orderedNames: string[] = [
    ...PDL_AUTOCOMPLETE_SHARED_KEY_ENV_NAMES,
    PDL_AUTOCOMPLETE_FALLBACK_KEY_ENV_NAME,
  ];

  if (args.includeTwentyFrontReservedKey) {
    orderedNames.push(PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME);
  }

  const seenValues = new Set<string>();
  const pool: PdlAutocompleteKeySlot[] = [];

  for (const name of orderedNames) {
    const value = args.keysByName[name]?.trim();
    if (!value || seenValues.has(value)) {
      continue;
    }

    // JAWAHAR is reserved for twenty-front org-chart autocomplete
    if (
      args.includeTwentyFrontReservedKey !== true &&
      reservedValue &&
      value === reservedValue
    ) {
      continue;
    }

    seenValues.add(value);
    pool.push({ name, value });
  }

  return pool;
};
