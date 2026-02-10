import styled from '@emotion/styled';
import { IconBrandLinkedin, IconWorld } from '@tabler/icons-react';

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

  svg {
    width: 14px;
    height: 14px;
  }
`;

export type OrgChartCompanyInfoProps = {
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
};

export const OrgChartCompanyInfo = ({
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
}: OrgChartCompanyInfoProps) => {
  const hasInfo =
    companyName ||
    website ||
    locationName ||
    industry ||
    typeof profileCount === 'number';

  if (!hasInfo) return null;

  return (
    <StyledCompanyInfo>
      {companyName && (
        <StyledCompanyTitleRow>
          <StyledCompanyTitle>{companyName}</StyledCompanyTitle>
          {linkedinUrl ? (
            <StyledLinkIcon
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open LinkedIn company page"
            >
              <IconBrandLinkedin />
            </StyledLinkIcon>
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
      {(locationName || industry || typeof profileCount === 'number') && (
        <StyledCompanyMetaRow>
          {locationName && <StyledMetaItem>{locationName}</StyledMetaItem>}
          {industry && <StyledMetaItem>{industry}</StyledMetaItem>}
          {typeof profileCount === 'number' && (
            <StyledMetaItem>
              {profileCount.toLocaleString()} profiles
            </StyledMetaItem>
          )}
        </StyledCompanyMetaRow>
      )}
    </StyledCompanyInfo>
  );
};
