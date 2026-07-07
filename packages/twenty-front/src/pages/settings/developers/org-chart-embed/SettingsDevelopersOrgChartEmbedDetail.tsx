import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { Button, H2Title, Section } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsOrgChartEmbedSnippetSection } from '@/settings/developers/components/SettingsOrgChartEmbedSnippetSection';
import {
  fetchOrgChartEmbed,
  revokeOrgChartEmbed,
  updateOrgChartEmbed,
} from '@/settings/developers/services/org-chart-embed-api.service';
import { OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  max-width: 560px;
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledSelect = styled.select`
  height: ${({ theme }) => theme.spacing(5)};
  padding: 0 ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
`;

export const SettingsDevelopersOrgChartEmbedDetail = () => {
  const { t } = useLingui();
  const { embedKeyId = '' } = useParams();
  const navigateSettings = useNavigateSettings();
  const { enqueueSnackBar } = useSnackBar();
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;

  const [embed, setEmbed] = useState<OrgChartEmbed | null>(null);
  const [usageToday, setUsageToday] = useState(0);
  const [usageMonthly, setUsageMonthly] = useState(0);
  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [snippetMode, setSnippetMode] = useState<'iframe' | 'inline'>('iframe');
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
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
          setUsageMonthly(
            (result as { usageMonthly?: number }).usageMonthly ?? 0,
          );
          setAllowedOrigins(result.embed.allowedOrigins.join(', '));
          setHidePoweredBy(result.embed.options?.hidePoweredBy === true);
          setSnippetMode(result.embed.options?.mode ?? 'iframe');
        }
      })
      .catch(() => {
        if (!cancelled) {
          enqueueSnackBar(t`Embed not found`, { variant: SnackBarVariant.Error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, embedKeyId, enqueueSnackBar, t]);

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
      enqueueSnackBar(t`Embed updated`, { variant: SnackBarVariant.Success });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error ? error.message : t`Failed to update embed`,
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, allowedOrigins, embed, enqueueSnackBar, hidePoweredBy, snippetMode, t]);

  const handleRevoke = useCallback(async () => {
    if (!accessToken || !embed) {
      return;
    }

    try {
      await revokeOrgChartEmbed(accessToken, embed.embedKey);
      enqueueSnackBar(t`Embed revoked`, { variant: SnackBarVariant.Success });
      navigateSettings(SettingsPath.Developers);
    } catch {
      enqueueSnackBar(t`Failed to revoke embed`, {
        variant: SnackBarVariant.Error,
      });
    }
  }, [accessToken, embed, enqueueSnackBar, navigateSettings, t]);

  if (!embed) {
    return (
      <SubMenuTopBarContainer title={t`Org chart embed`}>
        <SettingsPageContainer>
          <StyledMeta>{t`Loading…`}</StyledMeta>
        </SettingsPageContainer>
      </SubMenuTopBarContainer>
    );
  }

  return (
    <SubMenuTopBarContainer
      title={embed.name}
      links={[
        {
          children: t`Developers`,
          href: getSettingsPath(SettingsPath.Developers),
        },
        { children: embed.name },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title title={t`Embed key`} description={embed.embedKey} />
          <StyledMeta>
            {t`Views today`}: {usageToday} · {t`Views (30d)`}: {usageMonthly} ·{' '}
            {t`Mode`}: {embed.mode}
          </StyledMeta>
        </Section>

        <Section>
          <H2Title
            title={t`Allowed origins`}
            description={t`Comma-separated list of origins allowed to load this embed.`}
          />
          <StyledForm>
            <StyledField>
              <TextInput
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
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={hidePoweredBy}
                  onChange={(event) => setHidePoweredBy(event.target.checked)}
                />
                <StyledLabel style={{ margin: 0 }}>
                  {t`Hide "Powered by Arxena" (enterprise)`}
                </StyledLabel>
              </label>
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
            onClick={() => setIsRevokeModalOpen(true)}
          />
        </Section>
      </SettingsPageContainer>

      <ConfirmationModal
        isOpen={isRevokeModalOpen}
        setIsOpen={setIsRevokeModalOpen}
        title={t`Revoke embed key?`}
        subtitle={t`Embedded charts using this key will stop working.`}
        onConfirmClick={handleRevoke}
        deleteButtonText={t`Revoke`}
      />
    </SubMenuTopBarContainer>
  );
};
