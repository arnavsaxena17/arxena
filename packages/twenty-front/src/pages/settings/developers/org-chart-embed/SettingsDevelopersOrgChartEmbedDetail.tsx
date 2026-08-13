import { tokenPairState } from '@/auth/states/tokenPairState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsOrgChartEmbedSnippetSection } from '@/settings/developers/components/SettingsOrgChartEmbedSnippetSection';
import {
  fetchOrgChartEmbed,
  revokeOrgChartEmbed,
  updateOrgChartEmbed,
} from '@/settings/developers/services/org-chart-embed-api.service';
import { type OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { SETTINGS_API_WEBHOOKS_TABS } from '~/pages/settings/api-webhooks/constants/SettingsApiWebhooksTabs';

const REVOKE_ORG_CHART_EMBED_MODAL_ID = 'revoke-org-chart-embed-modal';

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

const StyledCheckboxRow = styled.label`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
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

export const SettingsDevelopersOrgChartEmbedDetail = () => {
  const { t } = useLingui();
  const { embedKeyId = '' } = useParams();
  const navigateSettings = useNavigateSettings();
  const { openModal } = useModal();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  const [embed, setEmbed] = useState<OrgChartEmbed | null>(null);
  const [usageToday, setUsageToday] = useState(0);
  const [usageMonthly, setUsageMonthly] = useState(0);
  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [snippetMode, setSnippetMode] = useState<'iframe' | 'inline'>('iframe');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!accessToken || !embedKeyId) {
      return;
    }

    let cancelled = false;
    void fetchOrgChartEmbed(accessToken, embedKeyId)
      .then((result) => {
        if (!cancelled) {
          setEmbed(result.embed);
          setUsageToday(result.usageToday);
          setUsageMonthly(result.usageMonthly);
          setAllowedOrigins(result.embed.allowedOrigins.join(', '));
          setHidePoweredBy(result.embed.options?.hidePoweredBy === true);
          setSnippetMode(result.embed.options?.mode ?? 'iframe');
        }
      })
      .catch(() => {
        if (!cancelled) {
          enqueueErrorSnackBar({ message: t`Embed not found` });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, embedKeyId, enqueueErrorSnackBar, t]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !embed) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateOrgChartEmbed(accessToken, embed.embedKey, {
        allowedOrigins: allowedOrigins
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
        options: {
          ...embed.options,
          mode: snippetMode,
          hidePoweredBy,
        },
      });
      setEmbed(updated);
      enqueueSuccessSnackBar({ message: t`Embed updated` });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to update embed`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    allowedOrigins,
    embed,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    hidePoweredBy,
    snippetMode,
    t,
  ]);

  const handleRevoke = useCallback(async () => {
    if (!accessToken || !embed) {
      return;
    }

    try {
      await revokeOrgChartEmbed(accessToken, embed.embedKey);
      enqueueSuccessSnackBar({ message: t`Embed revoked` });
      navigateSettings(
        SettingsPath.ApiWebhooks,
        undefined,
        undefined,
        undefined,
        SETTINGS_API_WEBHOOKS_TABS.TABS_IDS.ORG_CHART,
      );
    } catch {
      enqueueErrorSnackBar({ message: t`Failed to revoke embed` });
    }
  }, [
    accessToken,
    embed,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    navigateSettings,
    t,
  ]);

  if (!embed) {
    return (
      <SettingsPageLayout
        title={t`Org chart embed`}
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
          { children: t`Org chart embed` },
        ]}
      >
        <SettingsPageContainer>
          <StyledMeta>{t`Loading…`}</StyledMeta>
        </SettingsPageContainer>
      </SettingsPageLayout>
    );
  }

  return (
    <>
      <SettingsPageLayout
        title={embed.name}
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
          { children: embed.name },
        ]}
      >
        <SettingsPageContainer>
          <Section>
            <H2Title title={t`Embed key`} description={embed.embedKey} />
            <StyledMeta>
              {t`Views today`}: {usageToday} · {t`Views (30d)`}: {usageMonthly}{' '}
              · {t`Mode`}: {embed.mode}
            </StyledMeta>
          </Section>

          <Section>
            <H2Title
              title={t`Allowed origins`}
              description={t`Comma-separated list of origins allowed to load this embed.`}
            />
            <StyledForm>
              <StyledField>
                <SettingsTextInput
                  instanceId="org-chart-embed-detail-origins"
                  value={allowedOrigins}
                  onChange={setAllowedOrigins}
                  fullWidth
                />
              </StyledField>
              <StyledField>
                <StyledLabel>{t`Snippet render mode`}</StyledLabel>
                <StyledSelect
                  value={snippetMode}
                  onChange={(event) =>
                    setSnippetMode(event.target.value as 'iframe' | 'inline')
                  }
                >
                  <option value="iframe">{t`iframe (recommended)`}</option>
                  <option value="inline">{t`inline SDK`}</option>
                </StyledSelect>
              </StyledField>
              <StyledField>
                <StyledCheckboxRow>
                  <input
                    type="checkbox"
                    checked={hidePoweredBy}
                    onChange={(event) => setHidePoweredBy(event.target.checked)}
                  />
                  <StyledLabel>
                    {t`Hide "Powered by Arxena" (enterprise)`}
                  </StyledLabel>
                </StyledCheckboxRow>
              </StyledField>
              <Button
                title={t`Save changes`}
                onClick={handleSave}
                disabled={isSaving}
              />
            </StyledForm>
          </Section>

          <SettingsOrgChartEmbedSnippetSection
            embed={embed}
            snippetMode={snippetMode}
          />

          <Section>
            <Button
              title={t`Revoke embed key`}
              variant="secondary"
              accent="danger"
              onClick={() => openModal(REVOKE_ORG_CHART_EMBED_MODAL_ID)}
            />
          </Section>
        </SettingsPageContainer>
      </SettingsPageLayout>

      <ConfirmationModal
        modalInstanceId={REVOKE_ORG_CHART_EMBED_MODAL_ID}
        title={t`Revoke embed key?`}
        subtitle={t`Embedded charts using this key will stop working.`}
        onConfirmClick={handleRevoke}
        confirmButtonText={t`Revoke`}
      />
    </>
  );
};
