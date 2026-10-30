import {
  expandRoleWithFamilyFallback,
  titleFamilyFallbackTitles,
} from 'src/engine/core-modules/title-taxonomy/title-family-fallback.util';

describe('title family fallback', () => {
  it('adds the engineering leadership equivalents to VP Engineering', () => {
    const titles = expandRoleWithFamilyFallback('VP Engineering');

    expect(titles[0]).toBe('VP Engineering');
    expect(titles).toEqual(
      expect.arrayContaining(['Head of Engineering', 'CTO']),
    );
  });

  it('reads Indian plant titles as one family', () => {
    expect(expandRoleWithFamilyFallback('Plant Head')).toEqual(
      expect.arrayContaining([
        'Plant Manager',
        'Factory Manager',
        'Works Manager',
        'Unit Head',
      ]),
    );
  });

  it('keeps a bare function word as it is', () => {
    expect(expandRoleWithFamilyFallback('operations')).toEqual(['operations']);
  });

  it('expands COO to the operations leadership titles', () => {
    expect(titleFamilyFallbackTitles(['COO'])).toEqual(
      expect.arrayContaining([
        'Chief Operating Officer',
        'President Operations',
        'Head of Operations',
      ]),
    );
  });

  it('dedupes titles across roles and keeps the typed role', () => {
    const titles = titleFamilyFallbackTitles(['VP Engineering', 'CTO']);

    expect(titles.filter((title) => title === 'CTO')).toHaveLength(1);
    expect(titles[0]).toBe('VP Engineering');
  });
});
