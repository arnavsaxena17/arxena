import {
  phonesMatch,
  whatsappAccountMatchesWorkspaceMemberProfile,
  whatsappAccountIdentityMatchesWorkspaceMemberProfile,
} from '../unipileWorkspaceMemberMatch';
import { type UnipileWhatsappAccount } from '../../arx/ArxChatTypes';

describe('phonesMatch', () => {
  it('matches +918411937769 with 918411937769', () => {
    expect(phonesMatch('+918411937769', '918411937769')).toBe(true);
    expect(phonesMatch('918411937769', '+918411937769')).toBe(true);
  });

  it('matches when both sides share the same digits with formatting', () => {
    expect(phonesMatch('+91 84119 37769', '918411937769')).toBe(true);
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
      whatsappAccountMatchesWorkspaceMemberProfile(
        profileWithoutPlus,
        account,
      ),
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
      whatsappAccountMatchesWorkspaceMemberProfile(
        profileWithPlus,
        account,
      ),
    ).toBe(true);
  });
});
