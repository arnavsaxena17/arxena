import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export interface ApiKey {
  openaikey?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  linkedin_url?: string;
  whatsapp_key?: string;
  anthropic_key?: string;
  facebook_whatsapp_api_token?: string;
  facebook_whatsapp_phone_number_id?: string;
  facebook_whatsapp_app_id?: string;
  linkedin_unipile_account_id?: string;
  linkedin_profile_id?: string;
  whatsapp_web_phone_number?: string;
  facebook_whatsapp_asset_id?: string;
}

export const useApiKeys = () => {
  const { enqueueSnackBar } = useSnackBar();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keys, setKeys] = useState<ApiKey>({});
  const [originalKeys, setOriginalKeys] = useState<ApiKey>({});
  const [tokenPair] = useRecoilState(tokenPairState);

  const fetchApiKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/api-keys`,
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      console.log('data for all keys', data);
      setKeys(data);
      setOriginalKeys(data);
      return data;
    } catch (error) {
      enqueueSnackBar('Failed to load existing API keys', {
        variant: SnackBarVariant.Error,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair?.accessToken?.token, enqueueSnackBar]);

  const updateApiKeys = useCallback(async (newKeys: ApiKey) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/api-keys`,
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

      setOriginalKeys(newKeys);
      enqueueSnackBar('API keys updated successfully', {
        variant: SnackBarVariant.Success,
      });
      return true;
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to update API keys: ${error.message}`
          : 'Failed to update API keys',
        {
          variant: SnackBarVariant.Error,
        },
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [tokenPair?.accessToken?.token, enqueueSnackBar, isSubmitting]);

  const updateSpecificApiKey = useCallback(async (keyName: string, value: string) => {
    const updatedKeys = { ...keys, [keyName]: value };
    return await updateApiKeys(updatedKeys);
  }, [keys, updateApiKeys]);

  const resetKeys = useCallback(() => {
    setKeys(originalKeys);
  }, [originalKeys]);

  // Auto-fetch API keys when the hook is first used
  useEffect(() => {
    if (tokenPair?.accessToken?.token) {
      fetchApiKeys();
    }
  }, [tokenPair?.accessToken?.token, fetchApiKeys]);

  return {
    keys,
    setKeys,
    originalKeys,
    isLoading,
    isSubmitting,
    fetchApiKeys,
    updateApiKeys,
    updateSpecificApiKey,
    resetKeys,
  };
};
