import { useCallback, useState } from 'react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { useApiKeysState } from '@/arx-jd-upload/hooks/useApiKeysState';
import { type ApiKey } from '@/arx-jd-upload/states/apiKeysState';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { IconPencil } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  margin-top: ${themeCssVariables.spacing[3]};
`;

type ApiKeyFieldConfig = {
  field: keyof ApiKey;
  label: string;
};

const AI_FIELDS: ApiKeyFieldConfig[] = [
  { field: 'openaikey', label: 'OpenAI API Key' },
  { field: 'anthropic_key', label: 'Anthropic Key' },
];

const MESSAGING_FIELDS: ApiKeyFieldConfig[] = [
  { field: 'whatsapp_key', label: 'WhatsApp Key' },
  {
    field: 'whatsapp_unipile_account_id',
    label: 'WhatsApp Unipile Account ID',
  },
  {
    field: 'whatsapp_web_phone_number',
    label: 'WhatsApp Web Phone Number',
  },
  {
    field: 'facebook_whatsapp_api_token',
    label: 'Facebook WhatsApp API Token',
  },
  {
    field: 'facebook_whatsapp_phone_number_id',
    label: 'Facebook WhatsApp Phone Number ID',
  },
  {
    field: 'facebook_whatsapp_app_id',
    label: 'Facebook WhatsApp App ID',
  },
  {
    field: 'facebook_whatsapp_asset_id',
    label: 'Facebook WhatsApp Business Asset ID (WABA)',
  },
];

const LINKEDIN_FIELDS: ApiKeyFieldConfig[] = [
  { field: 'linkedin_url', label: 'LinkedIn Profile URL' },
  { field: 'linkedin_profile_id', label: 'LinkedIn Profile ID' },
  {
    field: 'linkedin_unipile_account_id',
    label: 'LinkedIn Unipile Account ID',
  },
];

const TWILIO_FIELDS: ApiKeyFieldConfig[] = [
  { field: 'twilio_account_sid', label: 'Twilio Account SID' },
  { field: 'twilio_auth_token', label: 'Twilio Auth Token' },
];

const WORKSPACE_FIELDS: ApiKeyFieldConfig[] = [
  {
    field: 'is_chrome_extension_installed',
    label: 'Is Chrome Extension Installed (true/false)',
  },
  { field: 'chrome_extension_id', label: 'Chrome Extension ID' },
  {
    field: 'is_org_chart_enabled',
    label: 'Is Org Chart Enabled (true/false)',
  },
];

export const ApiKeysForm = () => {
  const { t } = useLingui();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { keys, setKeys, isLoading, updateApiKeys, resetKeys } =
    useApiKeysState();

  const handleChange = useCallback(
    (field: keyof ApiKey) => (value: string) => {
      setKeys((previousKeys) => ({
        ...previousKeys,
        [field]: value,
      }));
      setErrors((previousErrors) => ({
        ...previousErrors,
        [field]: '',
      }));
    },
    [setKeys],
  );

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

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

  const renderField = ({ field, label }: ApiKeyFieldConfig) => (
    <SettingsTextInput
      key={field}
      instanceId={`workspace-api-key-${field}`}
      label={label}
      value={keys[field] || ''}
      onChange={handleChange(field)}
      error={errors[field]}
      disabled={!isEditing}
      fullWidth
      placeholder={isEditing ? `Enter ${label}` : t`No key set`}
      disableHotkeys={!isEditing}
    />
  );

  const renderGroup = (
    title: string,
    description: string,
    fields: ApiKeyFieldConfig[],
  ) => (
    <Section key={title}>
      <H2Title title={title} description={description} />
      <StyledInputContainer>{fields.map(renderField)}</StyledInputContainer>
    </Section>
  );

  if (isLoading) {
    return <div>{t`Loading API keys...`}</div>;
  }

  return (
    <StyledForm>
      {renderGroup(
        t`AI`,
        t`Provider keys used by ARX chat, sourcing, and LLM features for this workspace.`,
        AI_FIELDS,
      )}
      {renderGroup(
        t`Messaging`,
        t`WhatsApp Unipile, web, and Meta Business API credentials.`,
        MESSAGING_FIELDS,
      )}
      {renderGroup(
        t`LinkedIn`,
        t`LinkedIn profile and Unipile account identifiers.`,
        LINKEDIN_FIELDS,
      )}
      {renderGroup(
        t`Twilio`,
        t`Twilio credentials for SMS and voice integrations.`,
        TWILIO_FIELDS,
      )}
      {renderGroup(
        t`Workspace & extension`,
        t`Chrome extension and org chart workspace flags.`,
        WORKSPACE_FIELDS,
      )}
      <StyledButtonContainer>
        {isEditing ? (
          <>
            <Button
              title={t`Cancel`}
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            />
            <Button
              title={isSubmitting ? t`Saving...` : t`Save Changes`}
              accent="blue"
              disabled={isSubmitting}
              onClick={handleSubmit}
            />
          </>
        ) : (
          <Button
            title={t`Edit API Keys`}
            Icon={IconPencil}
            accent="blue"
            onClick={() => setIsEditing(true)}
          />
        )}
      </StyledButtonContainer>
    </StyledForm>
  );
};
