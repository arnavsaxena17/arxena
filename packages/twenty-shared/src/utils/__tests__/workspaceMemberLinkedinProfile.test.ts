import {
    hasWorkspaceMemberLinkedinFullProfile,
    hasWorkspaceMemberLinkedinOwnerProfile,
    mergeWorkspaceMemberLinkedinProfile,
    parseWorkspaceMemberLinkedinProfile,
} from '../workspaceMemberLinkedinProfile';

describe('workspaceMemberLinkedinProfile', () => {
  it('parseWorkspaceMemberLinkedinProfile parses JSON strings', () => {
    console.log('parseWorkspaceMemberLinkedinProfile string test: start');
    const parsed = parseWorkspaceMemberLinkedinProfile(
      JSON.stringify({ me: { public_identifier: 'alice' } }),
    );
    expect(parsed?.me).toEqual({ public_identifier: 'alice' });
    console.log('parseWorkspaceMemberLinkedinProfile string test: success', parsed);
  });

  it('hasWorkspaceMemberLinkedinFullProfile requires me, fullProfile, and publicIdentifier', () => {
    console.log('hasWorkspaceMemberLinkedinFullProfile test: start');
    expect(
      hasWorkspaceMemberLinkedinFullProfile({
        me: { public_identifier: 'alice' },
        fullProfile: { headline: 'CEO' },
        publicIdentifier: 'alice',
      }),
    ).toBe(true);
    expect(
      hasWorkspaceMemberLinkedinOwnerProfile({
        me: { public_identifier: 'alice' },
      }),
    ).toBe(true);
    expect(hasWorkspaceMemberLinkedinFullProfile({ me: { public_identifier: 'alice' } })).toBe(
      false,
    );
    console.log('hasWorkspaceMemberLinkedinFullProfile test: success');
  });

  it('mergeWorkspaceMemberLinkedinProfile preserves existing full profile when patching me only', () => {
    console.log('mergeWorkspaceMemberLinkedinProfile test: start');
    const merged = mergeWorkspaceMemberLinkedinProfile(
      {
        me: { public_identifier: 'alice' },
        fullProfile: { headline: 'CEO' },
        publicIdentifier: 'alice',
      },
      {
        me: { public_identifier: 'alice', first_name: 'Alice' },
        fetchedAt: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(merged.fullProfile).toEqual({ headline: 'CEO' });
    expect(merged.me).toEqual({
      public_identifier: 'alice',
      first_name: 'Alice',
    });
    console.log('mergeWorkspaceMemberLinkedinProfile test: success', merged);
  });
});
