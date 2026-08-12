import { tokenPairState } from '@/auth/states/tokenPairState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { createOrgChartEmbed } from '@/settings/developers/services/org-chart-embed-api.service';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { SETTINGS_API_WEBHOOKS_TABS } from '~/pages/settings/api-webhooks/constants/SettingsApiWebhooksTabs';

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  max-width: 560px;
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  height: ${themeCssVariables.spacing[8]};
  padding: 0 ${themeCssVariables.spacing[2]};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

export const SettingsDevelopersOrgChartEmbedNew = () => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const [name, setName] = useState('');
  const [mode, setMode] = useState<'live' | 'published'>('live');
  const [companyDomain, setCompanyDomain] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigateToOrgChartTab = useCallback(() => {
    navigateSettings(
      SettingsPath.ApiWebhooks,
      undefined,
      undefined,
      undefined,
      SETTINGS_API_WEBHOOKS_TABS.TABS_IDS.ORG_CHART,
    );
  }, [navigateSettings]);

  const handleCreate = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsSubmitting(true);
    try {
      const embed = await createOrgChartEmbed(accessToken, {
        name: name.trim(),
        mode,
        companyDomain: mode === 'live' ? companyDomain.trim() : undefined,
        publishSlug: mode === 'published' ? publishSlug.trim() : undefined,
        allowedOrigins: allowedOrigins
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
        options: { height: '600px', mode: 'iframe' },
      });

      enqueueSuccessSnackBar({ message: t`Embed key created` });
      navigateSettings(SettingsPath.DevelopersOrgChartEmbedDetail, {
        embedKeyId: embed.embedKey,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to create embed`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    allowedOrigins,
    companyDomain,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    mode,
    name,
    navigateSettings,
    publishSlug,
    t,
  ]);

  return (
    <SettingsPageLayout
      title={t`New org chart embed`}
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.General),
        },
        {
          children: t`MCP & APIs`,
          href: getSettingsPath(
            SettingsPath.ApiWebhooks,
            undefined,
            undefined,
            SETTINGS_API_WEBHOOKS_TABS.TABS_IDS.ORG_CHART,
          ),
        },
        { children: t`New embed` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Configuration`}
            description={t`Create an embed key for your website. Allowed origins must include the site where you paste the snippet.`}
          />
          <StyledForm>
            <StyledField>
              <StyledLabel>{t`Name`}</StyledLabel>
              <SettingsTextInput
                instanceId="org-chart-embed-new-name"
                value={name}
                onChange={setName}
                placeholder={t`Careers page`}
                fullWidth
              />
            </StyledField>
            <StyledField>
              <StyledLabel>{t`Mode`}</StyledLabel>
              <StyledSelect
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as 'live' | 'published')
                }
              >
                <option value="live">{t`Live (domain lookup)`}</option>
                <option value="published">{t`Published snapshot`}</option>
              </StyledSelect>
            </StyledField>
            {mode === 'live' ? (
              <StyledField>
                <StyledLabel>{t`Company domain`}</StyledLabel>
                <SettingsTextInput
                  instanceId="org-chart-embed-new-domain"
                  value={companyDomain}
                  onChange={setCompanyDomain}
                  placeholder="acme.com"
                  fullWidth
                />
              </StyledField>
            ) : (
              <StyledField>
                <StyledLabel>{t`Publish slug`}</StyledLabel>
                <SettingsTextInput
                  instanceId="org-chart-embed-new-slug"
                  value={publishSlug}
                  onChange={setPublishSlug}
                  placeholder="acme"
                  fullWidth
                />
              </StyledField>
            )}
            <StyledField>
              <StyledLabel>{t`Allowed origins (comma-separated)`}</StyledLabel>
              <SettingsTextInput
                instanceId="org-chart-embed-new-origins"
                value={allowedOrigins}
                onChange={setAllowedOrigins}
                placeholder="https://www.acme.com, https://*.acme.com"
                fullWidth
              />
            </StyledField>
            <StyledActions>
              <Button
                title={t`Create embed key`}
                onClick={handleCreate}
                disabled={
                  isSubmitting || !name.trim() || !allowedOrigins.trim()
                }
              />
              <Button
                title={t`Cancel`}
                variant="secondary"
                onClick={navigateToOrgChartTab}
              />
            </StyledActions>
          </StyledForm>
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
