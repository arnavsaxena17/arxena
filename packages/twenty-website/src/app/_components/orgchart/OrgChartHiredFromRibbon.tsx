'use client';

import styled from '@emotion/styled';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { toTitleCase } from 'twenty-shared';

function getLogoUrl(website?: string): string | null {
  if (!website?.trim()) return null;
  const base = '/api/org-chart';
  return `${base.replace(/\/$/, '')}/company-logo?website=${encodeURIComponent(website)}`;
}

function getLogoAbbreviation(website?: string, companyName?: string): string {
  if (website?.trim()) {
    const domain = website.replace(/^https?:\/\//, '').split('.')[0];
    const letter = domain?.[0];
    return letter
      ? letter.toUpperCase()
      : (companyName?.charAt(0)?.toUpperCase() ?? '?');
  }
  return companyName?.charAt(0)?.toUpperCase() ?? '?';
}

const StyledRibbon = styled.section`
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  background: ${({ theme }) => theme.background.tertiary};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledRibbonLabel = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 500;
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
`;

const StyledRibbonTrack = styled.div`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  overflow-x: auto;
  overflow-y: hidden;
  padding: ${({ theme }) => theme.spacing(0.5)} 0;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.transparent.light};
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.border.color.medium};
    border-radius: 2px;
  }
`;

const StyledRibbonLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1.5)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    border-color: ${({ theme }) => theme.border.color.medium};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledRibbonLogo = styled.img`
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  object-fit: contain;
  background: ${({ theme }) => theme.background.tertiary};
  flex-shrink: 0;
`;

const StyledRibbonLogoPlaceholder = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
`;

type OrgChartHiredFromRibbonProps = {
  companyId: string;
};

export const OrgChartHiredFromRibbon = ({
  companyId,
}: OrgChartHiredFromRibbonProps) => {
  const [companies, setCompanies] = useState<
    { id: string; name: string; website?: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const fetchCompanies = async () => {
      try {
        const res = await fetch(
          `/api/org-chart/companies/${encodeURIComponent(companyId)}/top-hired-from`,
        );
        if (cancelled) return;
        const data = (await res.json()) as {
          companies?: { id: string; name: string; website?: string }[];
        };
        if (Array.isArray(data?.companies) && data.companies.length > 0) {
          setCompanies(data.companies);
        }
      } catch {
        if (!cancelled) setCompanies([]);
      }
    };
    fetchCompanies();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (companies.length === 0) return null;

  return (
    <StyledRibbon aria-label="Companies most commonly hired from">
      <StyledRibbonLabel>Commonly hires from:</StyledRibbonLabel>
      <StyledRibbonTrack>
        {companies.map(({ id, name, website }) => (
          <RibbonCompanyLink key={id} id={id} name={name} website={website} />
        ))}
      </StyledRibbonTrack>
    </StyledRibbon>
  );
};

type RibbonCompanyLinkProps = {
  id: string;
  name: string;
  website?: string;
};

function RibbonCompanyLink({ id, name, website }: RibbonCompanyLinkProps) {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = getLogoUrl(website);
  const displayName = toTitleCase(name);
  const logoAbbreviation = getLogoAbbreviation(website, displayName);

  return (
    <StyledRibbonLink href={`/org-chart/${encodeURIComponent(id)}`}>
      {logoUrl && !logoError ? (
        <StyledRibbonLogo
          src={logoUrl}
          alt=""
          loading="lazy"
          onError={() => setLogoError(true)}
        />
      ) : (
        <StyledRibbonLogoPlaceholder>
          {logoAbbreviation !== '?' ? logoAbbreviation : '?'}
        </StyledRibbonLogoPlaceholder>
      )}
      {displayName}
    </StyledRibbonLink>
  );
}
