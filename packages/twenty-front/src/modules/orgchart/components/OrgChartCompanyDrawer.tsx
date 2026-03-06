import styled from '@emotion/styled';
import { IconWorld, IconX } from '@tabler/icons-react';

import { toTitleCase } from 'twenty-shared';

import type { OrgChartCompanyInfoProps } from './OrgChartCompanyInfo';

const LINKEDIN_ICON_URL = '/img/linkedin.svg';

const StyledDrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  z-index: 50;
  animation: fadeIn 0.2s ease-out;
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const StyledDrawer = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  background: ${({ theme }) => theme.background.primary};
  box-shadow: -4px 0 24px rgba(15, 23, 42, 0.15);
  z-index: 51;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s ease-out;
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

const StyledDrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledDrawerTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledDrawerBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledCompanyHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCompanyLogo = styled.img`
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  object-fit: contain;
  background: ${({ theme }) => theme.background.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyLogoPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyTitleBlock = styled.div`
  min-width: 0;
  flex: 1;
`;

const StyledCompanyName = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing(0.5)};
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledTagline = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.4;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSectionTitle = styled.h4`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const StyledSectionContent = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.5;
`;

const StyledLinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1.5)};
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
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

const StyledMetaGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledMetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledMetaLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
`;

const StyledMetaValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  text-align: right;
`;

export type OrgChartCompanyDrawerProps = OrgChartCompanyInfoProps & {
  isOpen: boolean;
  onClose: () => void;
};

export const OrgChartCompanyDrawer = ({
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
  hideProfileCountWhenUnipile,
  isOpen,
  onClose,
}: OrgChartCompanyDrawerProps) => {
  if (!isOpen) return null;

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

  const logoUrl = logoUrlProp?.trim() ? logoUrlProp : getLogoUrl(website);
  const websiteDomain = getDisplayDomain(website);
  const displayCompanyName = toTitleCase(companyName);
  const displayLocationName = toTitleCase(locationName);
  const displayIndustry = toTitleCase(industry);
  const linkedinLabel =
    toTitleCase(linkedinDisplayName) || displayCompanyName || 'LinkedIn';

  return (
    <>
      <StyledDrawerBackdrop onClick={onClose} aria-hidden="true" />
      <StyledDrawer role="dialog" aria-modal="true" aria-label="Company details">
        <StyledDrawerHeader>
          <StyledDrawerTitle>Company details</StyledDrawerTitle>
          <StyledCloseButton
            type="button"
            onClick={onClose}
            aria-label="Close company details"
          >
            <IconX size={20} />
          </StyledCloseButton>
        </StyledDrawerHeader>
        <StyledDrawerBody>
          <StyledCompanyHeader>
            {logoUrl ? (
              <StyledCompanyLogo src={logoUrl} alt="" loading="lazy" />
            ) : (
              <StyledCompanyLogoPlaceholder />
            )}
            <StyledCompanyTitleBlock>
              <StyledCompanyName>{displayCompanyName || 'Company'}</StyledCompanyName>
              {tagline?.trim() && (
                <StyledTagline>{tagline.trim()}</StyledTagline>
              )}
            </StyledCompanyTitleBlock>
          </StyledCompanyHeader>

          {(linkedinUrl || website) && (
            <StyledSection>
              <StyledSectionTitle>Links</StyledSectionTitle>
              <StyledLinkRow>
                {linkedinUrl && (
                  <StyledLink
                    href={linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open LinkedIn company page"
                  >
                    <StyledLinkedinLogo src={LINKEDIN_ICON_URL} alt="" />
                    {linkedinLabel}
                  </StyledLink>
                )}
                {website && (
                  <StyledLink
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open company website"
                  >
                    <IconWorld size={16} />
                    {websiteDomain || 'Website'}
                  </StyledLink>
                )}
              </StyledLinkRow>
            </StyledSection>
          )}

          <StyledSection>
            <StyledSectionTitle>Overview</StyledSectionTitle>
            <StyledMetaGrid>
              {displayLocationName && (
                <StyledMetaRow>
                  <StyledMetaLabel>Location</StyledMetaLabel>
                  <StyledMetaValue>{displayLocationName}</StyledMetaValue>
                </StyledMetaRow>
              )}
              {displayIndustry && (
                <StyledMetaRow>
                  <StyledMetaLabel>Industry</StyledMetaLabel>
                  <StyledMetaValue>{displayIndustry}</StyledMetaValue>
                </StyledMetaRow>
              )}
              {typeof employeeCount === 'number' && (
                <StyledMetaRow>
                  <StyledMetaLabel>Employees</StyledMetaLabel>
                  <StyledMetaValue>
                    {employeeCount.toLocaleString()}
                  </StyledMetaValue>
                </StyledMetaRow>
              )}
              {typeof profileCount === 'number' && !hideProfileCountWhenUnipile && (
                <StyledMetaRow>
                  <StyledMetaLabel>Profiles</StyledMetaLabel>
                  <StyledMetaValue>
                    {profileCount.toLocaleString()}
                  </StyledMetaValue>
                </StyledMetaRow>
              )}
            </StyledMetaGrid>
          </StyledSection>

          {description?.trim() && (
            <StyledSection>
              <StyledSectionTitle>About</StyledSectionTitle>
              <StyledSectionContent
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {description.trim()}
              </StyledSectionContent>
            </StyledSection>
          )}
        </StyledDrawerBody>
      </StyledDrawer>
    </>
  );
};
