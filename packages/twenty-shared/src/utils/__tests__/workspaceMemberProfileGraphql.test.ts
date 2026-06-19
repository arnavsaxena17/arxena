import {
    extractWorkspaceMemberProfileNode,
    parseWorkspaceMemberLinkedinCookieTokensFromGraphql,
    parseWorkspaceMemberProfileUnipileFields,
    workspaceMemberProfileFilterByMemberId,
} from '../workspaceMemberProfileGraphql';

describe('workspaceMemberProfileGraphql', () => {
  it('workspaceMemberProfileFilterByMemberId builds member filter', () => {
    console.log('workspaceMemberProfileFilterByMemberId: start');
    expect(workspaceMemberProfileFilterByMemberId('member-1')).toEqual({
      filter: { workspaceMemberId: { eq: 'member-1' } },
      limit: 1,
    });
    console.log('workspaceMemberProfileFilterByMemberId: success');
  });

  it('extractWorkspaceMemberProfileNode returns first node', () => {
    console.log('extractWorkspaceMemberProfileNode: start');
    const node = extractWorkspaceMemberProfileNode({
      data: {
        data: {
          workspaceMemberProfiles: {
            edges: [{ node: { id: 'profile-1', linkedinUrl: 'https://x' } }],
          },
        },
      },
    });
    expect(node?.id).toBe('profile-1');
    console.log('extractWorkspaceMemberProfileNode: success', node);
  });

  it('parseWorkspaceMemberProfileUnipileFields trims empty strings', () => {
    console.log('parseWorkspaceMemberProfileUnipileFields: start');
    const fields = parseWorkspaceMemberProfileUnipileFields({
      id: 'p1',
      phoneNumber: '  ',
      linkedinUrl: 'https://linkedin.com/in/foo',
      whatsappUnipileAccountId: 'wa-1',
      linkedinUnipileAccountId: '  li-1  ',
    });
    expect(fields).toEqual({
      phoneNumber: null,
      linkedinUrl: 'https://linkedin.com/in/foo',
      whatsappUnipileAccountId: 'wa-1',
      linkedinUnipileAccountId: 'li-1',
    });
    console.log('parseWorkspaceMemberProfileUnipileFields: success', fields);
  });

  it('parseWorkspaceMemberLinkedinCookieTokensFromGraphql decrypts tokens', () => {
    console.log('parseWorkspaceMemberLinkedinCookieTokensFromGraphql: start');
    const tokens = parseWorkspaceMemberLinkedinCookieTokensFromGraphql(
      {
        id: 'p1',
        linkedinLiAtToken: 'enc:token',
        linkedinLiAToken: null,
        linkedinUserAgent: ' UA ',
        linkedinIp: '1.2.3.4',
        linkedinCountry: 'us',
        linkedinCookiesLastSyncedAt: '2026-01-01T00:00:00.000Z',
        linkedinCookiesValidatedAt: null,
      },
      {
        decryptToken: (value) => (value === 'enc:token' ? 'plain' : value),
        normalizeCountry: (value) => value.toUpperCase(),
      },
    );
    expect(tokens.linkedinLiAtToken).toBe('plain');
    expect(tokens.linkedinUserAgent).toBe('UA');
    expect(tokens.linkedinCountry).toBe('US');
    console.log('parseWorkspaceMemberLinkedinCookieTokensFromGraphql: success', tokens);
  });
});
