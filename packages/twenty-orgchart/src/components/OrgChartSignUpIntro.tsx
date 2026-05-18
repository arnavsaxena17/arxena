import styled from '@emotion/styled';
import { IconSitemap } from '@tabler/icons-react';

import { formatOrgChartSliceLabel, type OrgChartNodeData } from 'twenty-shared';

const StyledFormBody = styled.div`
  padding: 40px 32px 32px;
`;

const StyledIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto ${({ theme }) => theme.spacing(2)};
  border-radius: 8px;
  background: #fafafa;
  color: #141414;
`;

const StyledSitemapIcon = styled(IconSitemap)`
  width: 26px;
  height: 26px;
`;

const StyledTitle = styled.h2`
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
  color: #141414;
  text-align: center;
`;

const StyledContextBadge = styled.p`
  margin: 0 auto 20px;
  max-width: 100%;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: #474747;
  text-align: center;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledCopyBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  text-align: left;
`;

const StyledText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: #474747;
  padding-left: 14px;
  border-left: 3px solid #141414;
`;

const StyledCtaButton = styled.button`
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: #141414;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: #2a2a2a;
  }

  &:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 3px;
  }
`;

const StyledCtaLink = styled.a`
  display: block;
  width: 100%;
  height: 48px;
  line-height: 48px;
  border: none;
  border-radius: 999px;
  background: #141414;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: inherit;
  text-align: center;
  text-decoration: none;
  box-sizing: border-box;

  &:hover {
    background: #2a2a2a;
  }

  &:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 3px;
  }
`;

const StyledDismiss = styled.button`
  display: block;
  width: 100%;
  margin: 16px 0 0;
  padding: 8px;
  border: none;
  background: none;
  font-size: 14px;
  font-family: inherit;
  color: #818181;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;

  &:hover {
    color: #474747;
  }

  &:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

export type OrgChartSignUpIntroProps = {
  node: OrgChartNodeData;
  titleId?: string;
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
  ctaLabel?: string;
  signUpUrl?: string;
  onCtaClick?: () => void;
  onDismiss?: () => void;
  showDismiss?: boolean;
};

export const OrgChartSignUpIntro = ({
  node,
  titleId = 'orgchart-signup-intro-title',
  companyName,
  selectedCountry,
  selectedFunctionRoot,
  ctaLabel = 'Sign up!',
  signUpUrl = '/welcome',
  onCtaClick,
  onDismiss,
  showDismiss = true,
}: OrgChartSignUpIntroProps) => {
  const companyTrimmed = companyName?.trim();
  const headline = companyTrimmed
    ? `${node.headline} at ${companyTrimmed}`
    : node.headline;
  const company = companyTrimmed || 'this company';
  const companyDisplay =
    company.charAt(0).toUpperCase() + company.slice(1).toLowerCase();

  const sliceParts: string[] = [];
  if (selectedCountry && selectedCountry !== 'global') {
    sliceParts.push(
      `by geography (e.g. ${formatOrgChartSliceLabel(selectedCountry)})`,
    );
  }
  if (selectedFunctionRoot && selectedFunctionRoot !== 'fullcompany') {
    sliceParts.push(
      `by function (e.g. ${formatOrgChartSliceLabel(selectedFunctionRoot)})`,
    );
  }
  if (sliceParts.length === 0) {
    sliceParts.push('by geography or function');
  }
  const sliceText =
    sliceParts.length > 1
      ? sliceParts.join(', ')
      : sliceParts[0] || 'by geography or function';

  return (
    <StyledFormBody>
      <StyledIconWrap aria-hidden>
        <StyledSitemapIcon stroke={1.5} />
      </StyledIconWrap>
      <StyledTitle id={titleId}>
        Start for free!
      </StyledTitle>
      <StyledContextBadge>{headline}</StyledContextBadge>
      <StyledCopyBlock>
        <StyledText>
          Get the {companyDisplay} org chart — {sliceText}, sliced any way you
          want.
        </StyledText>
        <StyledText>
          Get names, titles, emails & phone numbers for this role and the rest
          of the org chart.
        </StyledText>
        <StyledText>
          Use AI to automatically engage with contacts and focus only on the
          interested ones.
        </StyledText>
      </StyledCopyBlock>
      {onCtaClick ? (
        <StyledCtaButton type="button" onClick={onCtaClick}>
          {ctaLabel}
        </StyledCtaButton>
      ) : (
        <StyledCtaLink href={signUpUrl} rel="noreferrer">
          {ctaLabel}
        </StyledCtaLink>
      )}
      {showDismiss && onDismiss && (
        <StyledDismiss type="button" onClick={onDismiss}>
          Close
        </StyledDismiss>
      )}
    </StyledFormBody>
  );
};
