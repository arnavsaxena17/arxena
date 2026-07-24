import { useCallback } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { ApiKey, apiKeysErrorState, apiKeysLoadingState, apiKeysState, originalApiKeysState } from '../states/apiKeysState';

export const useApiKeysRecoil = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [apiKeys, setApiKeys] = useRecoilState(apiKeysState);
  const [originalKeys, setOriginalKeys] = useRecoilState(originalApiKeysState);
  const isLoading = useRecoilValue(apiKeysLoadingState);
  const error = useRecoilValue(apiKeysErrorState);
  const setError = useSetRecoilState(apiKeysErrorState);
  const { enqueueSnackBar } = useSnackBar();

  const updateApiKeys = useCallback(async (newKeys: ApiKey) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/workspace-keys`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
          body: JSON.stringify(newKeys),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setApiKeys(newKeys);
      setOriginalKeys(newKeys);
      enqueueSnackBar('API keys updated successfully', {
        variant: SnackBarVariant.Success,
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update API keys';
      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
      });
      return false;
    }
  }, [tokenPair?.accessToken?.token, setApiKeys, setOriginalKeys, enqueueSnackBar]);

  const updateSpecificApiKey = useCallback(async (keyName: string, value: string) => {
    const updatedKeys = { ...apiKeys, [keyName]: value };
    return await updateApiKeys(updatedKeys);
  }, [apiKeys, updateApiKeys]);

  const resetKeys = useCallback(() => {
    setApiKeys(originalKeys);
  }, [originalKeys, setApiKeys]);

  return {
    keys: apiKeys,
    setKeys: setApiKeys,
    originalKeys,
    isLoading,
    error,
    updateApiKeys,
    updateSpecificApiKey,
    resetKeys,
  };
};
