import {
    IconHierarchy2,
    IconInfoCircle,
    IconShare,
    IconWorld,
} from 'twenty-ui/icon';
import { useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { toTitleCase } from 'twenty-shared/utils';

import { getCompanyLogoAbbreviation } from '../utils/orgChartUtils';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const LINKEDIN_ICON_URL = '/img/linkedin.svg';

const StyledCompanyInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  min-width: 0;
`;

// Div (not button): header embeds nested links/buttons for LinkedIn, info, share
const StyledCompanyInfoClickable = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  min-width: 0;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  border-radius: ${themeCssVariables.border.radius.md};
  transition: background 0.15s ease;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledCompanyTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1.5]};
  min-width: 0;
`;

const StyledCompanyLogo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: ${themeCssVariables.border.radius.md};
  object-fit: contain;
  background: ${themeCssVariables.background.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyLogoPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.tertiary};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
`;

const StyledCompanyTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${themeCssVariables.font.color.primary};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const StyledTagline = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const StyledCompanyMetaRow = styled.div`
  min-width: 0;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
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
  border: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.primary};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledInfoButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.primary};
  cursor: pointer;
  padding: 0;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledLinkedinLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};
  border-radius: 999px;
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xs};
  text-decoration: none;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledLinkedinLogo = styled.img`
  width: 16px;
  height: 16px;
  display: block;
`;

const StyledLinkedinText = styled.span`
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export type OrgChartCompanyInfoProps = {
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  employeeCount?: number;
  linkedinDisplayName?: string;
  description?: string;
  tagline?: string;
  logoUrl?: string;
  onViewDetails?: () => void;
  onShare?: () => void;
  hideProfileCountWhenUnipile?: boolean;
};

export const OrgChartCompanyInfo = ({
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  employeeCount,
  linkedinDisplayName,
  description,
  tagline,
  logoUrl: logoUrlProp,
  onViewDetails,
  onShare,
  hideProfileCountWhenUnipile,
}: OrgChartCompanyInfoProps) => {
  const [logoError, setLogoError] = useState(false);

  const getLogoUrl = (site?: string): string | null => {
    if (!site?.trim()) return null;
    const base = REACT_APP_SERVER_BASE_URL ?? '';
    if (!base) return null;
    return `${base.replace(/\/$/, '')}/org-chart/company-logo?website=${encodeURIComponent(
      site,
    )}`;
  };

  const getDisplayDomain = (site?: string): string | null => {
    if (!site?.trim()) return null;
    try {
      const withProtocol = site.startsWith('http') ? site : `https://${site}`;
      const { hostname } = new URL(withProtocol);
      return hostname.replace(/^www\./u, '');
    } catch {
      return site;
    }
  };

  const logoUrl = logoUrlProp?.trim() ? logoUrlProp : getLogoUrl(website);
  const websiteDomain = getDisplayDomain(website);
  const displayCompanyName = toTitleCase(companyName);
  const displayLocationName = toTitleCase(locationName);
  const displayIndustry = toTitleCase(industry);
  const linkedinLabel =
    toTitleCase(linkedinDisplayName) || displayCompanyName || 'LinkedIn';
  const displayTagline = tagline?.trim();
  const logoAbbreviation = getCompanyLogoAbbreviation(
    website,
    displayCompanyName || companyName,
  );

  const hasInfo =
    displayCompanyName ||
    website ||
    displayLocationName ||
    displayIndustry ||
    displayTagline ||
    typeof profileCount === 'number' ||
    typeof employeeCount === 'number' ||
    description?.trim();

  if (!hasInfo) return null;

  const content = (
    <>
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
          {linkedinUrl ? (
            <StyledLinkedinLink
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open LinkedIn company page"
              onClick={(e) => e.stopPropagation()}
            >
              <StyledLinkedinLogo src={LINKEDIN_ICON_URL} alt="LinkedIn" />
              <StyledLinkedinText>{linkedinLabel}</StyledLinkedinText>
            </StyledLinkedinLink>
          ) : website ? (
            <StyledLinkIcon
              href={website}
              target="_blank"
              rel="noreferrer"
              aria-label="Open company website"
              onClick={(e) => e.stopPropagation()}
            >
              <IconWorld />
            </StyledLinkIcon>
          ) : null}
          {onViewDetails && (
            <StyledInfoButton
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              aria-label="View company details"
            >
              <IconInfoCircle size={16} />
            </StyledInfoButton>
          )}
          {onShare && (
            <StyledInfoButton
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              aria-label="Share org chart"
              title="Share"
            >
              <IconShare size={16} />
            </StyledInfoButton>
          )}
        </StyledCompanyTitleRow>
      )}
      {displayTagline && (
        <StyledTagline title={displayTagline}>{displayTagline}</StyledTagline>
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
              typeof profileCount === 'number' && !hideProfileCountWhenUnipile
                ? `Total ${profileCount.toLocaleString()} profiles`
                : '',
              typeof employeeCount === 'number'
                ? `Total ${employeeCount.toLocaleString()} employees`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            {[
              displayLocationName,
              displayIndustry,
              websiteDomain,
              typeof profileCount === 'number' && !hideProfileCountWhenUnipile
                ? `Total ${profileCount.toLocaleString()} profiles`
                : '',
              typeof employeeCount === 'number'
                ? `Total ${employeeCount.toLocaleString()} employees`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </StyledCompanyMetaLine>
        </StyledCompanyMetaRow>
      )}
    </>
  );

  if (onViewDetails) {
    return (
      <StyledCompanyInfoClickable
        role="button"
        tabIndex={0}
        onClick={onViewDetails}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onViewDetails();
          }
        }}
        aria-label="View company details"
      >
        {content}
      </StyledCompanyInfoClickable>
    );
  }

  return <StyledCompanyInfo>{content}</StyledCompanyInfo>;
};
