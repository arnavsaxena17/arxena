import { TOKEN_PAIR_LOCAL_STORAGE_KEY } from '@/auth/states/tokenPairState';
import { cookieStorage } from '~/utils/cookie-storage';

export const SIGNED_OUT_COOKIE_KEY = 'twentySignedOut';
export const SIGNED_OUT_QUERY_PARAM = 'signedOut';

const cookiePathAttributes = {
  path: '/',
};

const getSignedOutCookieAttributes = (frontDomain?: string) => ({
  ...cookiePathAttributes,
  expires: 1,
  ...(frontDomain ? { domain: `.${frontDomain}` } : {}),
});

export const hasSignedOutMarker = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (cookieStorage.getItem(SIGNED_OUT_COOKIE_KEY) === '1') {
      return true;
    }

    return (
      new URLSearchParams(window.location.search).get(
        SIGNED_OUT_QUERY_PARAM,
      ) === '1'
    );
  } catch {
    return false;
  }
};

export const markSignedOutAcrossSubdomains = (frontDomain?: string) => {
  if (frontDomain) {
    cookieStorage.setItem(
      SIGNED_OUT_COOKIE_KEY,
      '1',
      getSignedOutCookieAttributes(frontDomain),
    );
  }

  cookieStorage.setItem(
    SIGNED_OUT_COOKIE_KEY,
    '1',
    getSignedOutCookieAttributes(),
  );
};

export const clearSignedOutAcrossSubdomains = (frontDomain?: string) => {
  if (frontDomain) {
    cookieStorage.removeItem(
      SIGNED_OUT_COOKIE_KEY,
      getSignedOutCookieAttributes(frontDomain),
    );
  }

  cookieStorage.removeItem(
    SIGNED_OUT_COOKIE_KEY,
    getSignedOutCookieAttributes(),
  );
};

export const clearTokenPairIfSignedOut = (): boolean => {
  if (!hasSignedOutMarker()) {
    return false;
  }

  try {
    localStorage.removeItem(TOKEN_PAIR_LOCAL_STORAGE_KEY);
  } catch {
    // noop
  }

  return true;
};
