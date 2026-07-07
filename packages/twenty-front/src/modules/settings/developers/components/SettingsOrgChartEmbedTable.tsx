import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { fetchOrgChartEmbeds } from '@/settings/developers/services/org-chart-embed-api.service';
import { OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';
import { SettingsPath } from '@/types/SettingsPath';
import { Table } from '@/ui/layout/table/components/Table';
import { TableBody } from '@/ui/layout/table/components/TableBody';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { MOBILE_VIEWPORT } from 'twenty-ui';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

const StyledTableRow = styled(TableRow)`
  grid-template-columns: 1.5fr 1fr 1fr auto;
  @media (max-width: ${MOBILE_VIEWPORT}px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const StyledLink = styled.a`
  color: ${({ theme }) => theme.font.color.primary};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledMuted = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const SettingsOrgChartEmbedTable = () => {
  const { t } = useLingui();
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
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
      <StyledTableRow>
        <TableHeader>{t`Name`}</TableHeader>
        <TableHeader>{t`Mode`}</TableHeader>
        <TableHeader>{t`Domain`}</TableHeader>
        <TableHeader></TableHeader>
      </StyledTableRow>
      <TableBody>
        {embeds.map((embed) => (
          <StyledTableRow key={embed.embedKey}>
            <TableCell>
              <StyledLink
                href={getSettingsPath(SettingsPath.DevelopersOrgChartEmbedDetail, {
                  embedKeyId: embed.embedKey,
                })}
              >
                {embed.name}
              </StyledLink>
            </TableCell>
            <TableCell>{embed.mode}</TableCell>
            <TableCell>
              {embed.companyDomain ?? embed.publishSlug ?? '—'}
            </TableCell>
            <TableCell>{embed.embedKey.slice(0, 12)}…</TableCell>
          </StyledTableRow>
        ))}
      </TableBody>
    </Table>
  );
};
