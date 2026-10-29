import {
  personNamesMatch,
  personNamesRoughlyMatch,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/person-name-matching.util';

describe('personNamesMatch', () => {
  it('should match the same name with different case, honorifics and accents', () => {
    expect(personNamesMatch('Vikesh Shah', 'vikesh shah')).toBe(true);
    expect(personNamesMatch('Dr. Vikesh Shah', 'Vikesh Shah')).toBe(true);
    expect(personNamesMatch('José Álvarez', 'Jose Alvarez')).toBe(true);
  });

  it('should match a name inside a longer profile title', () => {
    expect(personNamesMatch('Vikesh Shah', 'Vikesh Shah - 99 Pancakes')).toBe(
      true,
    );
  });

  it('should not match different people', () => {
    expect(personNamesMatch('Binita Shah', 'Vikesh Shah')).toBe(false);
  });

  it('should never match on a single word', () => {
    expect(personNamesMatch('Vikesh', 'Vikesh Shah')).toBe(false);
    expect(personNamesMatch('', 'Vikesh Shah')).toBe(false);
  });
});

describe('personNamesRoughlyMatch', () => {
  it('should forgive a one-letter slip in a long word', () => {
    expect(
      personNamesRoughlyMatch('Krishna Kumar Chutani', 'Krishan Kumar Chutani'),
    ).toBe(true);
  });

  it('should not forgive a slip in a short word, or different names', () => {
    expect(personNamesRoughlyMatch('Amit Shah', 'Amir Shah')).toBe(false);
    expect(personNamesRoughlyMatch('Binita Shah', 'Vikesh Shah')).toBe(false);
  });
});
