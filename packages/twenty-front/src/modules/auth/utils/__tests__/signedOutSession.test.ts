import { TOKEN_PAIR_LOCAL_STORAGE_KEY } from '@/auth/states/tokenPairState';
import { cookieStorage } from '~/utils/cookie-storage';
import {
  SIGNED_OUT_COOKIE_KEY,
  clearSignedOutAcrossSubdomains,
  clearTokenPairIfSignedOut,
  hasSignedOutMarker,
  markSignedOutAcrossSubdomains,
  shouldDiscardStaleSignedOutSession,
} from '@/auth/utils/signedOutSession';

describe('signedOutSession', () => {
  beforeEach(() => {
    localStorage.clear();
    cookieStorage.removeItem(SIGNED_OUT_COOKIE_KEY, { path: '/' });
    window.history.replaceState({}, '', '/');
  });

  it('marks and detects a signed-out cookie', () => {
    expect(hasSignedOutMarker()).toBe(false);

    markSignedOutAcrossSubdomains('localhost');

    expect(cookieStorage.getItem(SIGNED_OUT_COOKIE_KEY)).toBe('1');
    expect(hasSignedOutMarker()).toBe(true);
  });

  it('detects the signedOut query param', () => {
    window.history.replaceState({}, '', '/welcome?signedOut=1');

    expect(hasSignedOutMarker()).toBe(true);
  });

  it('removes the persisted token pair when signed out', () => {
    localStorage.setItem(TOKEN_PAIR_LOCAL_STORAGE_KEY, '{"token":"stale"}');
    markSignedOutAcrossSubdomains();

    expect(clearTokenPairIfSignedOut()).toBe(true);
    expect(localStorage.getItem(TOKEN_PAIR_LOCAL_STORAGE_KEY)).toBeNull();
  });

  it('does not remove the token pair when the user is not signed out', () => {
    localStorage.setItem(TOKEN_PAIR_LOCAL_STORAGE_KEY, '{"token":"keep"}');

    expect(clearTokenPairIfSignedOut()).toBe(false);
    expect(localStorage.getItem(TOKEN_PAIR_LOCAL_STORAGE_KEY)).toBe(
      '{"token":"keep"}',
    );
  });

  it('clears the signed-out cookie', () => {
    markSignedOutAcrossSubdomains('localhost');
    clearSignedOutAcrossSubdomains('localhost');

    expect(cookieStorage.getItem(SIGNED_OUT_COOKIE_KEY)).toBeUndefined();
    expect(hasSignedOutMarker()).toBe(false);
  });

  it('discards leftover tokens after logout, but not a fresh sign-in', () => {
    expect(shouldDiscardStaleSignedOutSession(false)).toBe(false);

    markSignedOutAcrossSubdomains();

    expect(shouldDiscardStaleSignedOutSession(false)).toBe(true);
    expect(shouldDiscardStaleSignedOutSession(true)).toBe(false);
  });
});
