import styled from '@emotion/styled';
import { IconSitemap, IconX } from '@tabler/icons-react';

import { formatOrgChartSliceLabel, type OrgChartNodeData } from 'twenty-shared';

const StyledBackdrop = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledModal = styled.div`
  position: relative;
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const StyledAccent = styled.div`
  height: 4px;
  width: 100%;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.color.blue},
    ${({ theme }) => theme.color.blue}cc
  );
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(1)}
    0;
`;

const StyledCloseIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.blue};
    outline-offset: 2px;
  }
`;

const StyledCloseIcon = styled(IconX)`
  width: 20px;
  height: 20px;
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(3)};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.color.blue};
  margin-top: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledSitemapIcon = styled(IconSitemap)`
  width: 26px;
  height: 26px;
`;

const StyledTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.25;
  letter-spacing: -0.02em;
`;

const StyledContextBadge = styled.p`
  margin: 0;
  max-width: 100%;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: 999px;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  line-height: 1.4;
  color: ${({ theme }) => theme.font.color.secondary};
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledCopyBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
  width: 100%;
  text-align: left;
`;

const StyledText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.55;
  padding-left: ${({ theme }) => theme.spacing(2)};
  border-left: 3px solid ${({ theme }) => theme.color.blue};
`;

const StyledButton = styled.a`
  align-self: stretch;
  display: block;
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(1.75)} ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.font.color.primary};
  color: ${({ theme }) => theme.background.primary};
  text-decoration: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
  transition:
    filter 0.15s ease,
    transform 0.15s ease;

  &:hover {
    filter: brightness(1.12);
  }

  &:active {
    transform: scale(0.99);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.blue};
    outline-offset: 3px;
  }
`;

const StyledTextDismiss = styled.button`
  margin: 0;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: none;
  background: none;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.font.color.secondary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.blue};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.border.radius.sm};
  }
`;

export type OrgChartSignUpModalProps = {
  node: OrgChartNodeData | null;
  onClose: () => void;
  signUpUrl?: string;
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

export const OrgChartSignUpModal = ({
  node,
  onClose,
  signUpUrl = '/welcome',
  companyName,
  selectedCountry,
  selectedFunctionRoot,
}: OrgChartSignUpModalProps) => {
  if (!node) return null;

  const companyTrimmed = companyName?.trim();
  const headline = companyTrimmed
    ? `${node.headline} at ${companyTrimmed}`
    : node.headline;
  const company = companyTrimmed || 'this company';
  const companyDisplay =
    company.charAt(0).toUpperCase() + company.slice(1).toLowerCase();

  const sliceParts: string[] = [];
  if (selectedCountry && selectedCountry !== 'global') {
    sliceParts.push(`by geography (e.g. ${formatOrgChartSliceLabel(selectedCountry)})`);
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
    <StyledBackdrop onClick={onClose}>
      <StyledModal
        onClick={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orgchart-signup-modal-title"
      >
        <StyledAccent />
        <StyledHeader>
          <StyledCloseIconButton
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <StyledCloseIcon stroke={1.75} />
          </StyledCloseIconButton>
        </StyledHeader>
        <StyledContent>
          <StyledIconWrap aria-hidden>
            <StyledSitemapIcon stroke={1.5} />
          </StyledIconWrap>
          <StyledTitle id="orgchart-signup-modal-title">
            Start for free, no credit card required!
          </StyledTitle>
          <StyledContextBadge>{headline}</StyledContextBadge>
          <StyledCopyBlock>
            <StyledText>
              Get the {companyDisplay} org chart — {sliceText}, sliced any way
              you want.
            </StyledText>
            <StyledText>
              Get names, titles, emails & phone numbers for this role and the
              rest of the org chart.
            </StyledText>
            <StyledText>
              Use AI to automatically engage with contacts and focus only on the interested ones.
            </StyledText>
          </StyledCopyBlock>
          <StyledButton href={signUpUrl} rel="noreferrer">
            Sign up!
          </StyledButton>
          <StyledTextDismiss type="button" onClick={onClose}>
            Close
          </StyledTextDismiss>
        </StyledContent>
      </StyledModal>
    </StyledBackdrop>
  );
};
