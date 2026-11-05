import { getGoogleApisOauthScopes } from 'src/engine/core-modules/auth/utils/get-google-apis-oauth-scopes';

import { includesExpectedScopes } from './google-apis-scopes.service.util';

describe('GoogleAPIScopesService', () => {
  describe('includesExpectedScopes', () => {
    it('should return true when all expected scopes are present', () => {
      const scopes = [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ];
      const expectedScopes = ['email', 'profile'];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(true);
    });

    it('should return false when some expected scopes are missing', () => {
      const scopes = ['email', 'profile'];
      const expectedScopes = [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
      ];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(false);
    });

    it('should return true when expected scopes match with userinfo prefix fallback', () => {
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];
      const expectedScopes = ['email', 'profile'];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(true);
    });

    it('should return true when some scopes are direct matches and others use userinfo prefix', () => {
      const scopes = [
        'email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
      ];
      const expectedScopes = ['email', 'profile'];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(true);
    });

    it('should return true when 0 expected scopes', () => {
      const scopes = ['email', 'profile'];
      const expectedScopes: string[] = [];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(true);
    });

    it('should return false when 0 scopes but expected scopes', () => {
      const scopes: string[] = [];
      const expectedScopes = ['email', 'profile'];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(false);
    });

    it('should return true when both empty', () => {
      const scopes: string[] = [];
      const expectedScopes: string[] = [];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(true);
    });

    it('should handle case-sensitive scope matching', () => {
      const scopes = ['EMAIL', 'PROFILE'];
      const expectedScopes = ['email', 'profile'];

      const result = includesExpectedScopes(scopes, expectedScopes);

      expect(result).toBe(false);
    });

    it('should work with the current Google API scopes', () => {
      // What the tokeninfo endpoint returns for a freshly connected account.
      const actualGoogleScopes = [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/contacts',
      ];
      const expectedScopes = getGoogleApisOauthScopes();

      const result = includesExpectedScopes(actualGoogleScopes, expectedScopes);

      expect(result).toBe(true);
    });

    it('should fail when the token is missing a scope the app still requests', () => {
      const scopesWithoutCompose = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/contacts',
      ];

      expect(
        includesExpectedScopes(scopesWithoutCompose, getGoogleApisOauthScopes()),
      ).toBe(false);
    });
  });

  // The requested set is verified scope-by-scope with Google. Pinning it here means a scope cannot be
  // added to the request (or dropped from it) without this test failing and sending the developer to
  // google-verification/2-scope-audit.md.
  it('should request exactly the verified scope set', () => {
    expect(getGoogleApisOauthScopes()).toEqual([
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/contacts',
    ]);
  });
});
