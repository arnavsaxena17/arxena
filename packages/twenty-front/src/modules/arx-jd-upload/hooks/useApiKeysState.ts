import { useCallback } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import {
  type ApiKey,
  apiKeysErrorState,
  apiKeysLoadingState,
  apiKeysState,
  originalApiKeysState,
} from '../states/apiKeysState';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useApiKeysState = () => {
  const [tokenPair] = useAtomState(tokenPairState);
  const [apiKeys, setApiKeys] = useAtomState(apiKeysState);
  const [originalApiKeys, setOriginalApiKeys] = useAtomState(originalApiKeysState);
  const apiKeysLoading = useAtomStateValue(apiKeysLoadingState);
  const apiKeysError = useAtomStateValue(apiKeysErrorState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const updateApiKeys = useCallback(
    async (newKeys: ApiKey) => {
      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/workspace-modifications/workspace-keys`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            },
            body: JSON.stringify(newKeys),
          },
        );

        if (!response.ok) {
          throw new Error(await response.text());
        }

        setApiKeys(newKeys);
        setOriginalApiKeys(newKeys);
        enqueueSuccessSnackBar({
          message: 'API keys updated successfully',
        });
        return true;
      } catch (updateError) {
        const errorMessage =
          updateError instanceof Error
            ? updateError.message
            : 'Failed to update API keys';
        enqueueErrorSnackBar({ message: errorMessage });
        return false;
      }
    },
    [
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
      setApiKeys,
      setOriginalApiKeys,
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
    ],
  );

  const updateSpecificApiKey = useCallback(
    async (keyName: string, value: string) => {
      const updatedKeys = { ...apiKeys, [keyName]: value };
      return await updateApiKeys(updatedKeys);
    },
    [apiKeys, updateApiKeys],
  );

  const resetKeys = useCallback(() => {
    setApiKeys(originalApiKeys);
  }, [originalApiKeys, setApiKeys]);

  return {
    keys: apiKeys,
    setKeys: setApiKeys,
    originalKeys: originalApiKeys,
    isLoading: apiKeysLoading,
    error: apiKeysError,
    updateApiKeys,
    updateSpecificApiKey,
    resetKeys,
  };
};
