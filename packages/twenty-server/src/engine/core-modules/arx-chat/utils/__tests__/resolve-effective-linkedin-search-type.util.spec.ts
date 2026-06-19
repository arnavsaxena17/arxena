import { resolveEffectiveLinkedinSearchType } from 'src/engine/core-modules/arx-chat/utils/resolve-effective-linkedin-search-type.util';

describe('resolveEffectiveLinkedinSearchType', () => {
  const session = {
    accountId: 'account-1',
    accountIdSource: 'workspace_member_profile' as const,
    inferredSearchType: 'sales_navigator' as const,
    salesNavigatorAvailable: true,
    recruiterAvailable: false,
  };

  it('returns client search type when infer flag is off and client provided a value', () => {
    expect(
      resolveEffectiveLinkedinSearchType('classic', session, false),
    ).toBe('classic');
  });

  it('returns inferred search type when client omitted search type', () => {
    expect(resolveEffectiveLinkedinSearchType(undefined, session, false)).toBe(
      'sales_navigator',
    );
  });

  it('returns inferred search type when infer flag is on', () => {
    expect(
      resolveEffectiveLinkedinSearchType('classic', session, true),
    ).toBe('sales_navigator');
  });
});
