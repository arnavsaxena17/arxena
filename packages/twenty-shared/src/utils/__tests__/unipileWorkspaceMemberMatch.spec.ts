import {
  phonesMatch,
  whatsappAccountMatchesWorkspaceMemberProfile,
  whatsappAccountIdentityMatchesWorkspaceMemberProfile,
  linkedinAccountIdentityMatchesWorkspaceMemberProfile,
  linkedinAccountMatchesWorkspaceMemberProfile,
} from '../unipileWorkspaceMemberMatch';
import {
  type UnipileLinkedinAccount,
  type UnipileWhatsappAccount,
} from '../../arx/ArxChatTypes';

describe('phonesMatch', () => {
  it('matches +918411937769 with 918411937769', () => {
    expect(phonesMatch('+918411937769', '918411937769')).toBe(true);
    expect(phonesMatch('918411937769', '+918411937769')).toBe(true);
  });

  it('matches when both sides share the same digits with formatting', () => {
    expect(phonesMatch('+91 84119 37769', '918411937769')).toBe(true);
  });
});

describe('linkedin account identity matches member URL and Unipile id', () => {
  const nareshProfile = {
    phoneNumber: null,
    linkedinUrl: 'https://www.linkedin.com/in/naresh-lahoti-0b774821',
    whatsappUnipileAccountId: null,
    linkedinUnipileAccountId: 'XFBjnwWKQsmpSFWzcjOStg',
  };

  const nareshAccount = {
    id: 'XFBjnwWKQsmpSFWzcjOStg',
    status: 'connected',
    username: 'Naresh Lahoti',
    name: 'Naresh Lahoti',
    type: 'LINKEDIN',
    provider: 'LINKEDIN',
    connection_params: {
      im: { publicIdentifier: 'naresh-lahoti-0b774821' },
    },
  } as UnipileLinkedinAccount;

  const saranyaAccount = {
    id: 'tbEiDUiNTwihwgmIZ7LUEg',
    status: 'connected',
    username: 'Saranya KR',
    name: 'Saranya KR',
    type: 'LINKEDIN',
    provider: 'LINKEDIN',
    connection_params: {
      im: { publicIdentifier: 'saranya-kr-b6b636251' },
    },
  } as UnipileLinkedinAccount;

  it('matches Naresh by member URL slug', () => {
    expect(
      linkedinAccountMatchesWorkspaceMemberProfile(
        nareshProfile,
        nareshAccount,
      ),
    ).toBe(true);
  });

  it('rejects another person even when that Unipile id is stored on the member', () => {
    const profileWithWrongStoredId = {
      ...nareshProfile,
      linkedinUnipileAccountId: saranyaAccount.id,
    };
    expect(
      linkedinAccountIdentityMatchesWorkspaceMemberProfile(
        profileWithWrongStoredId,
        saranyaAccount,
      ),
    ).toBe(false);
    expect(
      linkedinAccountMatchesWorkspaceMemberProfile(
        profileWithWrongStoredId,
        saranyaAccount,
      ),
    ).toBe(false);
  });

  it('falls back to member Unipile id when account has no publicIdentifier', () => {
    const accountWithoutSlug = {
      ...nareshAccount,
      connection_params: undefined,
      username: 'Naresh Lahoti',
    } as UnipileLinkedinAccount;
    expect(
      linkedinAccountIdentityMatchesWorkspaceMemberProfile(
        nareshProfile,
        accountWithoutSlug,
      ),
    ).toBe(true);
  });

  it('matches by stored Unipile id when member has no LinkedIn URL', () => {
    const profileWithoutUrl = {
      ...nareshProfile,
      linkedinUrl: null,
    };
    expect(
      linkedinAccountIdentityMatchesWorkspaceMemberProfile(
        profileWithoutUrl,
        nareshAccount,
      ),
    ).toBe(true);
  });
});

describe('whatsapp account phone match with + / no-+ forms', () => {
  const connectedAccount = (
    overrides: Partial<UnipileWhatsappAccount> = {},
  ): UnipileWhatsappAccount =>
    ({
      id: 'pWhQlMmoTfWsCSI_6oWkfA',
      username: '918411937769',
      name: '918411937769',
      phone_number: '918411937769',
      status: 'connected',
      provider: 'WHATSAPP',
      ...overrides,
    }) as UnipileWhatsappAccount;

  const profileWithPlus = {
    phoneNumber: '+918411937769',
    linkedinUrl: null,
    whatsappUnipileAccountId: null,
    linkedinUnipileAccountId: null,
  };

  const profileWithoutPlus = {
    phoneNumber: '918411937769',
    linkedinUrl: null,
    whatsappUnipileAccountId: null,
    linkedinUnipileAccountId: null,
  };

  it('matches profile +918411937769 to Unipile 918411937769', () => {
    expect(
      whatsappAccountMatchesWorkspaceMemberProfile(
        profileWithPlus,
        connectedAccount(),
      ),
    ).toBe(true);
    expect(
      whatsappAccountIdentityMatchesWorkspaceMemberProfile(
        profileWithPlus,
        connectedAccount(),
      ),
    ).toBe(true);
  });

  it('matches profile 918411937769 to Unipile +918411937769', () => {
    const account = connectedAccount({
      phone_number: '+918411937769',
      username: '+918411937769',
      name: '+918411937769',
    });
    expect(
      whatsappAccountMatchesWorkspaceMemberProfile(profileWithoutPlus, account),
    ).toBe(true);
  });

  it('matches via connection_params.im.phone_number when phone_number is empty', () => {
    const account = connectedAccount({
      phone_number: '',
      username: 'Unknown',
      name: 'Unknown',
      connection_params: { im: { phone_number: '918411937769' } },
    });
    expect(
      whatsappAccountMatchesWorkspaceMemberProfile(profileWithPlus, account),
    ).toBe(true);
  });
});
