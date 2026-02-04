import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
    getArxenaSiteBaseUrl,
    getArxenaSiteUrlWithToken,
} from '@/auth/utils/arxenaSiteUrl';

/**
 * Returns a function to open arxena-site (org charts) with the current user's
 * Twenty access token in the URL. Arxena-site will read the token from the hash,
 * set the auth_token cookie, and authenticate the same user (no MongoDB linking).
 *
 * Opens in the same tab by default; pass { newTab: true } to open in a new tab.
 */
export const useOpenArxenaSiteWithToken = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? null;

  const openArxenaSiteWithToken = useCallback(
    (options?: { path?: string; newTab?: boolean }) => {
      if (!accessToken) {
        return;
      }
      const path = options?.path ?? '/';
      const url = getArxenaSiteUrlWithToken(accessToken, path);
      if (options?.newTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = url;
      }
    },
    [accessToken],
  );

  return {
    openArxenaSiteWithToken,
    arxenaSiteBaseUrl: getArxenaSiteBaseUrl(),
    hasToken: Boolean(accessToken),
  };
};
