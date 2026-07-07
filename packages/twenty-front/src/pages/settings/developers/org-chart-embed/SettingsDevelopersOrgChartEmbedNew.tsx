import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, H2Title, Section } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { createOrgChartEmbed } from '@/settings/developers/services/org-chart-embed-api.service';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
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

const StyledSelect = styled.select`
  height: ${({ theme }) => theme.spacing(5)};
  padding: 0 ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const SettingsDevelopersOrgChartEmbedNew = () => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const { enqueueSnackBar } = useSnackBar();
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;

  const [name, setName] = useState('');
  const [mode, setMode] = useState<'live' | 'published'>('live');
  const [companyDomain, setCompanyDomain] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      enqueueSnackBar(t`Embed key created`, {
        variant: SnackBarVariant.Success,
      });
      navigateSettings(SettingsPath.DevelopersOrgChartEmbedDetail, {
        embedKeyId: embed.embedKey,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error ? error.message : t`Failed to create embed`,
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    allowedOrigins,
    companyDomain,
    enqueueSnackBar,
    mode,
    name,
    navigateSettings,
    publishSlug,
    t,
  ]);

  return (
    <SubMenuTopBarContainer
      title={t`New org chart embed`}
      links={[
        {
          children: t`Developers`,
          href: getSettingsPath(SettingsPath.Developers),
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
              <TextInput
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
                <TextInput
                  value={companyDomain}
                  onChange={setCompanyDomain}
                  placeholder="acme.com"
                  fullWidth
                />
              </StyledField>
            ) : (
              <StyledField>
                <StyledLabel>{t`Publish slug`}</StyledLabel>
                <TextInput
                  value={publishSlug}
                  onChange={setPublishSlug}
                  placeholder="acme"
                  fullWidth
                />
              </StyledField>
            )}
            <StyledField>
              <StyledLabel>{t`Allowed origins (comma-separated)`}</StyledLabel>
              <TextInput
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
                disabled={isSubmitting || !name.trim() || !allowedOrigins.trim()}
              />
              <Button
                title={t`Cancel`}
                variant="secondary"
                onClick={() => navigateSettings(SettingsPath.Developers)}
              />
            </StyledActions>
          </StyledForm>
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
