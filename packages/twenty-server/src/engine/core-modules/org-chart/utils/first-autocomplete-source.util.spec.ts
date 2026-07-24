import { resolveFirstAutocompleteSource } from './first-autocomplete-source.util';

describe('resolveFirstAutocompleteSource', () => {
  it('returns apollo when auth token exists', () => {
    expect(
      resolveFirstAutocompleteSource({ authToken: 'BearerToken' }),
    ).toBe('apollo');
  });

  it('returns elasticsearch when auth token is missing', () => {
    expect(resolveFirstAutocompleteSource({ authToken: undefined })).toBe(
      'elasticsearch',
    );
  });

  it('returns elasticsearch when auth token is blank', () => {
    expect(resolveFirstAutocompleteSource({ authToken: '   ' })).toBe(
      'elasticsearch',
    );
  });
});
