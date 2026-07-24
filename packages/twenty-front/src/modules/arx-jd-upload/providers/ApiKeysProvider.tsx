import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { apiKeysErrorState, apiKeysLoadingState, apiKeysState, originalApiKeysState } from '../states/apiKeysState';

export const ApiKeysProvider = ({ children }: { children: React.ReactNode }) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const setApiKeys = useSetRecoilState(apiKeysState);
  const setOriginalKeys = useSetRecoilState(originalApiKeysState);
  const setLoading = useSetRecoilState(apiKeysLoadingState);
  const setError = useSetRecoilState(apiKeysErrorState);
  const { enqueueSnackBar } = useSnackBar();

  const lastFetchedTokenRef = useRef<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    if (!tokenPair?.accessToken?.token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/workspace-keys`,
        {
          headers: {
            Authorization: `Bearer ${tokenPair.accessToken.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data);
      setOriginalKeys(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load API keys';
      setError(errorMessage);
      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setLoading(false);
    }
  }, [tokenPair?.accessToken?.token, setApiKeys, setOriginalKeys, setLoading, setError, enqueueSnackBar]);

  // Fetch once per access token. Do not use `Object.keys(apiKeys).length === 0`:
  // the server returns `{}` when the workspace schema is not ready yet (e.g. onboarding),
  // which is a valid loaded state and must not retrigger fetch in a loop.
  useEffect(() => {
    const token = tokenPair?.accessToken?.token;
    if (!token) {
      lastFetchedTokenRef.current = null;
      return;
    }
    if (lastFetchedTokenRef.current === token) {
      return;
    }
    lastFetchedTokenRef.current = token;
    void fetchApiKeys();
  }, [tokenPair?.accessToken?.token, fetchApiKeys]);

  return <>{children}</>;
};
