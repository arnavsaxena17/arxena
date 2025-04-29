import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 16px;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
`;

const StyledButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  background-color: ${({ variant, theme }) =>
    variant === 'secondary' ? theme.background.tertiary : theme.color.blue};
  color: ${({ variant, theme }) =>
    variant === 'secondary'
      ? theme.font.color.primary
      : theme.font.color.inverted};
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid
    ${({ variant, theme }) =>
      variant === 'secondary' ? theme.border.color.medium : theme.color.blue};
  cursor: pointer;

  &:hover {
    background-color: ${({ variant, theme }) =>
      variant === 'secondary'
        ? theme.background.quaternary
        : theme.color.blue60};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface ApiKey {
  openaikey?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  linkedin_url?: string;
  whatsapp_key?: string;
  anthropic_key?: string;
  facebook_whatsapp_api_token?: string;
  facebook_whatsapp_phone_number_id?: string;
  facebook_whatsapp_app_id?: string;

  whatsapp_web_phone_number?:string;
  facebook_whatsapp_asset_id?: string;
}

export const ApiKeysForm = () => {
  const { enqueueSnackBar } = useSnackBar();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [keys, setKeys] = useState<ApiKey>({});
  const [originalKeys, setOriginalKeys] = useState<ApiKey>({});
  const [tokenPair] = useRecoilState(tokenPairState);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchExistingKeys();
  }, []);

  const fetchExistingKeys = async () => {
    try {
      const response = await fetch(
        process.env.REACT_APP_SERVER_BASE_URL +
          '/workspace-modifications/api-keys',
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
      setKeys(data);
      setOriginalKeys(data);
    } catch (error) {
      enqueueSnackBar('Failed to load existing API keys', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = useCallback(
    (field: string) => (value: string) => {
      setKeys((prev) => ({
        ...prev,
        [field]: value,
      }));
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    },
    [],
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        process.env.REACT_APP_SERVER_BASE_URL +
          '/workspace-modifications/api-keys',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
          body: JSON.stringify(keys),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setOriginalKeys(keys);
      setIsEditing(false);
      enqueueSnackBar('API keys updated successfully', {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to update API keys: ${error.message}`
          : 'Failed to update API keys',
        {
          variant: SnackBarVariant.Error,
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setKeys(originalKeys);
    setErrors({});
    setIsEditing(false);
  };

  const renderInput = (field: keyof ApiKey, label: string) => (
    <TextInput
      label={label}
      value={keys[field] || ''}
      onChange={handleChange(field)}
      error={errors[field]}
      disabled={!isEditing}
      fullWidth
      placeholder={isEditing ? `Enter ${label}` : 'No key set'}
    />
  );

  if (isLoading) {
    return <div>Loading API keys...</div>;
  }

  return (
    <StyledInputContainer>
      {renderInput('openaikey', 'OpenAI API Key')}
      {renderInput('twilio_account_sid', 'Twilio Account SID')}
      {renderInput('twilio_auth_token', 'Twilio Auth Token')}
      {renderInput('linkedin_url', 'Linkedin Profile URL')}
      {renderInput('whatsapp_key', 'WhatsApp Key')}
      {renderInput('anthropic_key', 'Anthropic Key')}
      {renderInput(
        'facebook_whatsapp_api_token',
        'Facebook WhatsApp API Token (Do Not Change)',
      )}
      {renderInput(
        'facebook_whatsapp_phone_number_id',
        'Facebook WhatsApp Phone Number ID',
      )}
      {renderInput(
        'whatsapp_web_phone_number',
        'WhatsApp Web Phone Number',
      )}
      {renderInput(
        'facebook_whatsapp_app_id',
        'Facebook WhatsApp App ID (Do Not Change)',
      )}
      {renderInput(
        'facebook_whatsapp_asset_id',
        'Facebook WhatsApp Business Asset ID (WABA)',
      )}

      <StyledButtonContainer>
        {isEditing ? (
          <>
            <StyledButton
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </StyledButton>
            <StyledButton onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </StyledButton>
          </>
        ) : (
          <StyledButton onClick={() => setIsEditing(true)}>
            Edit API Keys
          </StyledButton>
        )}
      </StyledButtonContainer>
    </StyledInputContainer>
  );
};
