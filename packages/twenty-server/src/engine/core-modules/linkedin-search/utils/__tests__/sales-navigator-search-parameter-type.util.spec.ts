import { isSalesNavigatorSearchParameterType } from '../sales-navigator-search-parameter-type.util';

describe('isSalesNavigatorSearchParameterType', () => {
  it('marks lead and account lists as Sales Navigator', () => {
    expect(isSalesNavigatorSearchParameterType('LEAD_LISTS')).toBe(true);
    expect(isSalesNavigatorSearchParameterType('ACCOUNT_LISTS')).toBe(true);
  });

  it('does not mark classic facets as Sales Navigator', () => {
    expect(isSalesNavigatorSearchParameterType('LOCATION')).toBe(false);
    expect(isSalesNavigatorSearchParameterType('COMPANY')).toBe(false);
  });
});
