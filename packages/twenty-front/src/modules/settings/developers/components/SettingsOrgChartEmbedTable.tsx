import { tokenPairState } from '@/auth/states/tokenPairState';
import { fetchOrgChartEmbeds } from '@/settings/developers/services/org-chart-embed-api.service';
import { type OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';
import { Table } from '@/ui/layout/table/components/Table';
import { TableBody } from '@/ui/layout/table/components/TableBody';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTableBodyContainer = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledLink = styled.a`
  color: ${themeCssVariables.font.color.primary};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledMuted = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const GRID_AUTO_COLUMNS = '1.5fr 1fr 1fr auto';

export const SettingsOrgChartEmbedTable = () => {
  const { t } = useLingui();
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const [embeds, setEmbeds] = useState<OrgChartEmbed[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setEmbeds([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void fetchOrgChartEmbeds(accessToken)
      .then((items) => {
        if (!cancelled) {
          setEmbeds(items.filter((item) => !item.revokedAt));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmbeds([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (isLoading) {
    return <StyledMuted>{t`Loading embed keys…`}</StyledMuted>;
  }

  if (embeds.length === 0) {
    return (
      <StyledMuted>{t`No org chart embed keys yet. Create one to get a snippet for your website.`}</StyledMuted>
    );
  }

  return (
    <Table>
      <TableRow gridAutoColumns={GRID_AUTO_COLUMNS}>
        <TableHeader>{t`Name`}</TableHeader>
        <TableHeader>{t`Mode`}</TableHeader>
        <TableHeader>{t`Domain`}</TableHeader>
        <TableHeader></TableHeader>
      </TableRow>
      <StyledTableBodyContainer>
        <TableBody>
          {embeds.map((embed) => (
            <TableRow key={embed.embedKey} gridAutoColumns={GRID_AUTO_COLUMNS}>
              <TableCell>
                <StyledLink
                  href={getSettingsPath(
                    SettingsPath.DevelopersOrgChartEmbedDetail,
                    {
                      embedKeyId: embed.embedKey,
                    },
                  )}
                >
                  {embed.name}
                </StyledLink>
              </TableCell>
              <TableCell>{embed.mode}</TableCell>
              <TableCell>
                {embed.companyDomain ?? embed.publishSlug ?? '—'}
              </TableCell>
              <TableCell>
                <StyledMuted>{embed.embedKey.slice(0, 12)}…</StyledMuted>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </StyledTableBodyContainer>
    </Table>
  );
};
