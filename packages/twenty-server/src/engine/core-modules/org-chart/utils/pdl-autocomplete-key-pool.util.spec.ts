import {
  PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME,
  resolvePdlAutocompleteKeyPool,
} from './pdl-autocomplete-key-pool.util';

const KEYS = {
  PARAG_PDL_API_KEY: 'parag-key',
  ARXENACO_PDL_API_KEY: 'arxenaco-key',
  RAVI_PDL_API_KEY: 'ravi-key',
  JAWAHAR_PDL_API_KEY: 'jawahar-key',
  PDL_API_KEY: 'legacy-key',
};

describe('resolvePdlAutocompleteKeyPool', () => {
  it('uses shared keys plus legacy PDL_API_KEY for public autocomplete', () => {
    expect(
      resolvePdlAutocompleteKeyPool({
        keysByName: KEYS,
        includeTwentyFrontReservedKey: false,
      }).map((slot) => slot.name),
    ).toEqual([
      'PARAG_PDL_API_KEY',
      'ARXENACO_PDL_API_KEY',
      'RAVI_PDL_API_KEY',
      'PDL_API_KEY',
    ]);
  });

  it('appends the reserved twenty-front key last', () => {
    expect(
      resolvePdlAutocompleteKeyPool({
        keysByName: KEYS,
        includeTwentyFrontReservedKey: true,
      }).map((slot) => slot.name),
    ).toEqual([
      'PARAG_PDL_API_KEY',
      'ARXENACO_PDL_API_KEY',
      'RAVI_PDL_API_KEY',
      'PDL_API_KEY',
      PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME,
    ]);
  });

  it('does not leak the reserved key into the public pool via PDL_API_KEY', () => {
    expect(
      resolvePdlAutocompleteKeyPool({
        keysByName: {
          ...KEYS,
          PDL_API_KEY: KEYS.JAWAHAR_PDL_API_KEY,
        },
        includeTwentyFrontReservedKey: false,
      }).map((slot) => slot.value),
    ).not.toContain(KEYS.JAWAHAR_PDL_API_KEY);
  });

  it('deduplicates when PDL_API_KEY matches a shared key', () => {
    const pool = resolvePdlAutocompleteKeyPool({
      keysByName: {
        ...KEYS,
        PDL_API_KEY: KEYS.RAVI_PDL_API_KEY,
      },
      includeTwentyFrontReservedKey: false,
    });

    expect(pool.map((slot) => slot.value)).toEqual([
      'parag-key',
      'arxenaco-key',
      'ravi-key',
    ]);
  });

  it('skips blank keys', () => {
    expect(
      resolvePdlAutocompleteKeyPool({
        keysByName: {
          PARAG_PDL_API_KEY: '  ',
          RAVI_PDL_API_KEY: 'ravi-key',
        },
        includeTwentyFrontReservedKey: false,
      }),
    ).toEqual([{ name: 'RAVI_PDL_API_KEY', value: 'ravi-key' }]);
  });
});
