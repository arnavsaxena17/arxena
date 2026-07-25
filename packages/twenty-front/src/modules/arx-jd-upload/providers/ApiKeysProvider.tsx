import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useCallback, useEffect, useRef } from 'react';

import {
  apiKeysErrorState,
  apiKeysLoadingState,
  apiKeysState,
  originalApiKeysState,
} from '../states/apiKeysState';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const ApiKeysProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [tokenPair] = useAtomState(tokenPairState);
  const setApiKeys = useSetAtomState(apiKeysState);
  const setOriginalKeys = useSetAtomState(originalApiKeysState);
  const setLoading = useSetAtomState(apiKeysLoadingState);
  const setError = useSetAtomState(apiKeysErrorState);
  const { enqueueErrorSnackBar } = useSnackBar();

  const lastFetchedTokenRef = useRef<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/workspace-modifications/workspace-keys`,
        {
          headers: {
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
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
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load API keys';
      setError(errorMessage);
      enqueueErrorSnackBar({ message: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    setApiKeys,
    setOriginalKeys,
    setLoading,
    setError,
    enqueueErrorSnackBar,
  ]);

  // Fetch once per access token. Do not use `Object.keys(apiKeys).length === 0`:
  // the server returns `{}` when the workspace schema is not ready yet (e.g. onboarding),
  // which is a valid loaded state and must not retrigger fetch in a loop.
  useEffect(() => {
    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
    if (!token) {
      lastFetchedTokenRef.current = null;
      return;
    }
    if (lastFetchedTokenRef.current === token) {
      return;
    }
    lastFetchedTokenRef.current = token;
    void fetchApiKeys();
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token, fetchApiKeys]);

  return <>{children}</>;
};
