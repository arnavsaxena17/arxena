import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { Button, H2Title, Section } from 'twenty-ui';

import { getArxenaSiteBaseUrl } from '@/auth/utils/arxenaSiteUrl';
import { OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';
import {
  buildOrgChartEmbedSnippet,
  type BuildOrgChartEmbedSnippetInput,
} from '@/settings/developers/utils/buildOrgChartEmbedSnippet';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const StyledPre = styled.pre`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow-x: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  white-space: pre-wrap;
  word-break: break-all;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

type SettingsOrgChartEmbedSnippetSectionProps = {
  embed: OrgChartEmbed;
  snippetMode?: BuildOrgChartEmbedSnippetInput['mode'];
};

export const SettingsOrgChartEmbedSnippetSection = ({
  embed,
  snippetMode = 'iframe',
}: SettingsOrgChartEmbedSnippetSectionProps) => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();

  const snippet = buildOrgChartEmbedSnippet({
    embedKey: embed.embedKey,
    domain: embed.companyDomain ?? 'example.com',
    height: embed.options?.height ?? '600px',
    mode: snippetMode,
    siteBaseUrl: getArxenaSiteBaseUrl(),
  });

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      enqueueSnackBar(t`Snippet copied to clipboard`, {
        variant: SnackBarVariant.Success,
      });
    } catch {
      enqueueSnackBar(t`Failed to copy snippet`, {
        variant: SnackBarVariant.Error,
      });
    }
  }, [enqueueSnackBar, snippet, t]);

  return (
    <Section>
      <H2Title
        title={t`Embed snippet`}
        description={t`Paste this on your website. The loader uses the ARXENA-branded function(A,r,x,e,n,a) pattern.`}
      />
      <StyledPre>{snippet}</StyledPre>
      <StyledActions>
        <Button
          title={t`Copy snippet`}
          size="small"
          variant="secondary"
          onClick={copySnippet}
        />
      </StyledActions>
    </Section>
  );
};
