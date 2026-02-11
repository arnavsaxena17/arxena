import styled from '@emotion/styled';
import { IconWorld } from '@tabler/icons-react';

const LINKEDIN_ICON_URL = '/img/linkedin-icon-png-circle-2.png';

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

const StyledCompanyTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const StyledCompanyMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};

  &:not(:last-child)::after {
    content: '·';
    margin-left: ${({ theme }) => theme.spacing(1)};
  }
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

const StyledLinkedinLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
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
}: OrgChartCompanyInfoProps) => {
  const getLogoUrl = (site?: string): string | null => {
    if (!site?.trim()) return null;
    const base = process.env.REACT_APP_SERVER_BASE_URL ?? '';
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

  const logoUrl = getLogoUrl(website);
  const websiteDomain = getDisplayDomain(website);
  const linkedinLabel = linkedinDisplayName || companyName || 'LinkedIn';

  const hasInfo =
    companyName ||
    website ||
    locationName ||
    industry ||
    typeof profileCount === 'number' ||
    typeof employeeCount === 'number';

  if (!hasInfo) return null;

  return (
    <StyledCompanyInfo>
      {companyName && (
        <StyledCompanyTitleRow>
          {logoUrl && (
            <StyledCompanyLogo
              src={logoUrl}
              alt=""
              loading="lazy"
            />
          )}
          <StyledCompanyTitle>{companyName}</StyledCompanyTitle>
          {linkedinUrl ? (
            <StyledLinkedinLink
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open LinkedIn company page"
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
            >
              <IconWorld />
            </StyledLinkIcon>
          ) : null}
        </StyledCompanyTitleRow>
      )}
      {(locationName ||
        industry ||
        websiteDomain ||
        typeof profileCount === 'number' ||
        typeof employeeCount === 'number') && (
        <StyledCompanyMetaRow>
          {locationName && <StyledMetaItem>{locationName}</StyledMetaItem>}
          {industry && <StyledMetaItem>{industry}</StyledMetaItem>}
          {websiteDomain && <StyledMetaItem>{websiteDomain}</StyledMetaItem>}
          {typeof profileCount === 'number' && (
            <StyledMetaItem>
              {profileCount.toLocaleString()} profiles
            </StyledMetaItem>
          )}
          {typeof employeeCount === 'number' && (
            <StyledMetaItem>
              {employeeCount.toLocaleString()} employees
            </StyledMetaItem>
          )}
        </StyledCompanyMetaRow>
      )}
    </StyledCompanyInfo>
  );
};
