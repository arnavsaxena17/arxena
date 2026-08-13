import { getArxenaSiteBaseUrl } from '@/auth/utils/arxenaSiteUrl';
import { type OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';
import {
  buildOrgChartEmbedSnippet,
  type BuildOrgChartEmbedSnippetInput,
} from '@/settings/developers/utils/buildOrgChartEmbedSnippet';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledPre = styled.pre`
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  overflow-x: auto;
  padding: ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
  word-break: break-all;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
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
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

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
      enqueueSuccessSnackBar({
        message: t`Snippet copied to clipboard`,
      });
    } catch {
      enqueueErrorSnackBar({
        message: t`Failed to copy snippet`,
      });
    }
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, snippet, t]);

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
