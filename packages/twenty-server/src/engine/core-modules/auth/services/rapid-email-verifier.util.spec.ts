import { getSignupEmailRejectionMessage } from 'src/engine/core-modules/auth/services/rapid-email-verifier.util';

describe('getSignupEmailRejectionMessage', () => {
  it('returns typo suggestion message when typoSuggestion is set', () => {
    expect(
      getSignupEmailRejectionMessage({
        email: 'a@gmai.com',
        validations: {
          syntax: true,
          domain_exists: true,
          mx_records: true,
          mailbox_exists: true,
          is_disposable: false,
          is_role_based: false,
        },
        score: 80,
        status: 'PROBABLY_VALID',
        typoSuggestion: 'a@gmail.com',
      }),
    ).toContain('a@gmail.com');
  });

  it('returns alias message when aliasOf is set', () => {
    expect(
      getSignupEmailRejectionMessage({
        email: 'u+tag@gmail.com',
        validations: {
          syntax: true,
          domain_exists: true,
          mx_records: true,
          mailbox_exists: true,
          is_disposable: false,
          is_role_based: false,
        },
        score: 100,
        status: 'VALID',
        aliasOf: 'u@gmail.com',
      }),
    ).toContain('u@gmail.com');
  });

  it('returns null when validations pass', () => {
    expect(
      getSignupEmailRejectionMessage({
        email: 'user@company.com',
        validations: {
          syntax: true,
          domain_exists: true,
          mx_records: true,
          mailbox_exists: true,
          is_disposable: false,
          is_role_based: false,
        },
        score: 100,
        status: 'VALID',
      }),
    ).toBeNull();
  });

  it('rejects disposable', () => {
    expect(
      getSignupEmailRejectionMessage({
        email: 't@mailinator.com',
        validations: {
          syntax: true,
          domain_exists: true,
          mx_records: true,
          mailbox_exists: true,
          is_disposable: true,
          is_role_based: false,
        },
        score: 90,
        status: 'DISPOSABLE',
      }),
    ).toContain('Disposable');
  });

  it('rejects role-based', () => {
    expect(
      getSignupEmailRejectionMessage({
        email: 'info@company.com',
        validations: {
          syntax: true,
          domain_exists: true,
          mx_records: true,
          mailbox_exists: true,
          is_disposable: false,
          is_role_based: true,
        },
        score: 85,
        status: 'ROLE',
      }),
    ).toContain('shared role');
  });

  it('rejects missing MX', () => {
    expect(
      getSignupEmailRejectionMessage({
        email: 'x@bad.local',
        validations: {
          syntax: true,
          domain_exists: false,
          mx_records: false,
          mailbox_exists: false,
          is_disposable: false,
          is_role_based: false,
        },
        score: 0,
        status: 'INVALID',
      }),
    ).toContain('cannot receive mail');
  });
});
