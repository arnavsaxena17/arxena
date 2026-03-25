import { useApiKeysRecoil } from '@/arx-jd-upload/hooks/useApiKeysRecoil';
import { ApiKey } from '@/arx-jd-upload/states/apiKeysState';
import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

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


export const ApiKeysForm = () => {
  const isOrgChartEnabled = useRecoilValue(isOrgChartEnabledState);
  const { enqueueSnackBar } = useSnackBar();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const {
    keys,
    setKeys,
    originalKeys,
    isLoading,
    updateApiKeys,
    resetKeys,
  } = useApiKeysRecoil();


  console.log("keys::", keys);
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
      const success = await updateApiKeys(keys);
      if (success) {
        setIsEditing(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetKeys();
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


  const renderInputs = () => {
    return (
      <>
  {renderInput('openaikey', 'OpenAI API Key')}
  {renderInput('twilio_account_sid', 'Twilio Account SID')}
  {renderInput('twilio_auth_token', 'Twilio Auth Token')}
  {renderInput('linkedin_url', 'Linkedin Profile URL')}
  {renderInput('linkedin_profile_id', 'Linkedin Profile ID')}
  {renderInput('linkedin_unipile_account_id', 'Linkedin Unipile Account ID')}
  {renderInput('whatsapp_unipile_account_id', 'Whatsapp Unipile Account ID')}
  {renderInput('whatsapp_key', 'WhatsApp Key')}
  {renderInput('anthropic_key', 'Anthropic Key')}
  {renderInput( 'facebook_whatsapp_api_token', 'Facebook WhatsApp API Token (Do Not Change)', )}
  {renderInput( 'facebook_whatsapp_phone_number_id', 'Facebook WhatsApp Phone Number ID', )}
  {renderInput( 'whatsapp_web_phone_number', 'WhatsApp Web Phone Number', )}
  {renderInput( 'facebook_whatsapp_app_id', 'Facebook WhatsApp App ID (Do Not Change)', )}
  {renderInput( 'facebook_whatsapp_asset_id', 'Facebook WhatsApp Business Asset ID (WABA)', )}
  {renderInput( 'is_chrome_extension_installed', 'Is Chrome Extension Installed (true/false)', )}
  {renderInput( 'chrome_extension_id', 'Chrome Extension ID', )}
  {renderInput( 'is_org_chart_enabled', 'Is Org Chart Enabled (true/false)', )}
      </>
    );
  };


  const renderOrgChartInputs = () => {
    return (
      <>
      {renderInput('openaikey', 'OpenAI API Key')}
      {renderInput('linkedin_url', 'Linkedin Profile URL')}
      {renderInput('linkedin_profile_id', 'Linkedin Profile ID')}
      {renderInput('linkedin_unipile_account_id', 'Linkedin Unipile Account ID')}
      {renderInput( 'whatsapp_web_phone_number', 'WhatsApp Web Phone Number', )}
      {renderInput('whatsapp_unipile_account_id', 'Whatsapp Unipile Account ID')}
      {renderInput('is_org_chart_enabled', 'Is Org Chart Enabled (true/false)')}

    </>
    );
  };

  return (
    <StyledInputContainer>
      {isOrgChartEnabled ? renderInputs() : renderInputs()}
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
