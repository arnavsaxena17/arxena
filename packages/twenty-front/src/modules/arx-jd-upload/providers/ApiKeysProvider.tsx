import { useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { apiKeysErrorState, apiKeysLoadingState, apiKeysState } from '../states/apiKeysState';

export const ApiKeysProvider = ({ children }: { children: React.ReactNode }) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [apiKeys, setApiKeys] = useRecoilState(apiKeysState);
  const setLoading = useSetRecoilState(apiKeysLoadingState);
  const setError = useSetRecoilState(apiKeysErrorState);
  const { enqueueSnackBar } = useSnackBar();

  const fetchApiKeys = useCallback(async () => {
    if (!tokenPair?.accessToken?.token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('fetching api keys in ApiKeysProvider');
      
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/api-keys`,
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
      console.log('data for all keys', data);
      setApiKeys(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load API keys';
      setError(errorMessage);
      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setLoading(false);
    }
  }, [tokenPair?.accessToken?.token, setApiKeys, setLoading, setError, enqueueSnackBar]);

  // Fetch API keys when the component mounts or when token changes
  useEffect(() => {
    if (tokenPair?.accessToken?.token && Object.keys(apiKeys).length === 0) {
      fetchApiKeys();
    }
  }, [tokenPair?.accessToken?.token, fetchApiKeys, apiKeys]);

  return <>{children}</>;
};
