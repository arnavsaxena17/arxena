import { tokenPairState } from '@/auth/states/tokenPairState';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { useUnipile } from '../contexts/UnipileContext';
import { tryExtensionLinkedinUnipileRecovery } from '../utils/linkedinUnipileExtensionBridge';

const VISIBILITY_RECOVERY_MIN_INTERVAL_MS = 90_000;

/**
 * When the user returns to the tab (e.g. after signing in on LinkedIn), retry extension→Unipile sync once.
 */
export const LinkedinUnipileVisibilityRecoveryEffect = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? '';
  const { isLinkedinConnected, refreshAccounts } = useUnipile();
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!accessToken.trim() || isLinkedinConnected) {
      return;
    }

    const baseUrl = REACT_APP_SERVER_BASE_URL?.replace(/\/$/, '') ?? '';
    if (!baseUrl) {
      return;
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (!accessToken.trim() || isLinkedinConnected) {
        return;
      }
      const now = Date.now();
      if (now - lastRunRef.current < VISIBILITY_RECOVERY_MIN_INTERVAL_MS) {
        return;
      }
      lastRunRef.current = now;
      void (async () => {
        const result = await tryExtensionLinkedinUnipileRecovery({
          accessToken,
          serverBaseUrl: baseUrl,
        });
        if (result.ok) {
          await refreshAccounts();
        }
      })();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [accessToken, isLinkedinConnected, refreshAccounts]);

  return null;
};
