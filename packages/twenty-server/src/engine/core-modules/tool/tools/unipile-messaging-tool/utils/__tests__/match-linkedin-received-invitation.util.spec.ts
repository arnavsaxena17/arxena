import {
  findMatchingLinkedinReceivedInvitation,
  type LinkedinReceivedInvitation,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/match-linkedin-received-invitation.util';

const buildInvitation = (
  overrides: Partial<LinkedinReceivedInvitation> & {
    inviter?: LinkedinReceivedInvitation['inviter'];
  } = {},
): LinkedinReceivedInvitation => ({
  id: 'invite-1',
  inviter: {
    inviter_name: 'Jane Doe',
    inviter_id: 'ACoAAAJane',
    inviter_public_identifier: 'jane-doe',
    inviter_description: 'Engineer',
    ...overrides.inviter,
  },
  specifics: {
    provider: 'LINKEDIN',
    shared_secret: 'secret-1',
  },
  ...overrides,
});

describe('findMatchingLinkedinReceivedInvitation', () => {
  it('matches inviter_id case-insensitively', () => {
    const items = [buildInvitation()];

    expect(
      findMatchingLinkedinReceivedInvitation(items, ['  acoaAAjane  '])?.id,
    ).toBe('invite-1');
  });

  it('matches inviter_public_identifier case-insensitively', () => {
    const items = [buildInvitation()];

    expect(
      findMatchingLinkedinReceivedInvitation(items, ['Jane-Doe'])?.id,
    ).toBe('invite-1');
  });

  it('returns undefined when no identifiers match', () => {
    const items = [buildInvitation()];

    expect(
      findMatchingLinkedinReceivedInvitation(items, ['other-person']),
    ).toBeUndefined();
  });

  it('returns undefined when identifiers are empty', () => {
    const items = [buildInvitation()];

    expect(
      findMatchingLinkedinReceivedInvitation(items, ['', '  ']),
    ).toBeUndefined();
  });
});
