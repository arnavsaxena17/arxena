'use client';

import styled from '@emotion/styled';
import {
    IconBrandLinkedin,
    IconHierarchy2,
    IconWorld,
} from '@tabler/icons-react';
import { useState } from 'react';

import { toTitleCase } from 'twenty-shared';

const StyledCompanyInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  min-width: 0;
`;

const StyledCompanyTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  min-width: 0;
`;

const StyledCompanyLogo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  object-fit: contain;
  background: ${({ theme }) => theme.background.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyLogoPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
`;

const StyledCompanyTitle = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const StyledCompanyMetaRow = styled.div`
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledCompanyMetaLine = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const StyledLinkIcon = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

export type OrgChartCompanyInfoProps = {
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  employeeCount?: number;
  logoBaseUrl?: string;
};

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

function getLogoUrl(website?: string, logoBaseUrl?: string): string | null {
  if (!website?.trim()) return null;
  const base = logoBaseUrl ?? '/api/org-chart';
  return `${base.replace(/\/$/, '')}/company-logo?website=${encodeURIComponent(website)}`;
}

function getDisplayDomain(website?: string): string | null {
  if (!website?.trim()) return null;
  try {
    const withProtocol = website.startsWith('http')
      ? website
      : `https://${website}`;
    const { hostname } = new URL(withProtocol);
    return hostname.replace(/^www\./u, '');
  } catch {
    return website;
  }
}

export const OrgChartCompanyInfo = ({
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  employeeCount,
  logoBaseUrl = '/api/org-chart',
}: OrgChartCompanyInfoProps) => {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = getLogoUrl(website, logoBaseUrl);
  const websiteDomain = getDisplayDomain(website);
  const displayCompanyName = toTitleCase(companyName);
  const logoAbbreviation = getLogoAbbreviation(
    website,
    displayCompanyName || companyName,
  );
  const displayLocationName = toTitleCase(locationName);
  const displayIndustry = toTitleCase(industry);

  const hasInfo =
    displayCompanyName ||
    website ||
    displayLocationName ||
    displayIndustry ||
    typeof profileCount === 'number' ||
    typeof employeeCount === 'number';

  if (!hasInfo) return null;

  return (
    <StyledCompanyInfo>
      {displayCompanyName && (
        <StyledCompanyTitleRow>
          {logoUrl && !logoError ? (
            <StyledCompanyLogo
              src={logoUrl}
              alt=""
              loading="lazy"
              onError={() => setLogoError(true)}
            />
          ) : (
            <StyledCompanyLogoPlaceholder>
              {logoAbbreviation !== '?' ? (
                logoAbbreviation
              ) : (
                <IconHierarchy2 size={20} />
              )}
            </StyledCompanyLogoPlaceholder>
          )}
          <StyledCompanyTitle>{displayCompanyName}</StyledCompanyTitle>
          {website ? (
            <StyledLinkIcon
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open company website"
            >
              <IconWorld size={14} />
            </StyledLinkIcon>
          ) : null}
          {linkedinUrl ? (
            <StyledLinkIcon
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open company LinkedIn"
            >
              <IconBrandLinkedin size={14} />
            </StyledLinkIcon>
          ) : null}
        </StyledCompanyTitleRow>
      )}
      {(displayLocationName ||
        displayIndustry ||
        websiteDomain ||
        typeof profileCount === 'number' ||
        typeof employeeCount === 'number') && (
        <StyledCompanyMetaRow>
          <StyledCompanyMetaLine
            title={[
              displayLocationName,
              displayIndustry,
              websiteDomain,
              typeof profileCount === 'number'
                ? `${profileCount.toLocaleString()} profiles`
                : '',
              typeof employeeCount === 'number'
                ? `${employeeCount.toLocaleString()} employees`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            {[
              displayLocationName,
              displayIndustry,
              websiteDomain,
              typeof profileCount === 'number'
                ? `${profileCount.toLocaleString()} profiles`
                : '',
              typeof employeeCount === 'number'
                ? `${employeeCount.toLocaleString()} employees`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </StyledCompanyMetaLine>
        </StyledCompanyMetaRow>
      )}
    </StyledCompanyInfo>
  );
};
