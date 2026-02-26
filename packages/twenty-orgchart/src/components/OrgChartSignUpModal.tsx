import styled from '@emotion/styled';

import type { OrgChartNodeData } from 'twenty-shared';

const StyledBackdrop = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

const StyledModal = styled.div`
  width: 400px;
  max-width: 100%;
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  text-align: center;
`;

const StyledNodeInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
`;

const StyledText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.5;
`;

const StyledButton = styled.a`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.font.color.primary};
  color: ${({ theme }) => theme.background.primary};
  text-decoration: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-weight: 500;
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
  transition: color 0.15s ease;

  &:hover {
    color: #9e9e9e;
  }
`;

const StyledCloseButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: transparent;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1.5)};
  justify-content: flex-end;
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

export type OrgChartSignUpModalProps = {
  node: OrgChartNodeData | null;
  onClose: () => void;
  signUpUrl?: string;
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

const formatLabel = (s: string): string =>
  s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

export const OrgChartSignUpModal = ({
  node,
  onClose,
  signUpUrl = '/sign-up',
  companyName,
  selectedCountry,
  selectedFunctionRoot,
}: OrgChartSignUpModalProps) => {
  if (!node) return null;

  const headline = (node.headline + ' at ' + companyName)
  const company = companyName?.trim() || 'this company';
  const companyDisplay =
    company.charAt(0).toUpperCase() + company.slice(1).toLowerCase();

  const sliceParts: string[] = [];
  if (selectedCountry && selectedCountry !== 'global') {
    sliceParts.push(`by geography (e.g. ${formatLabel(selectedCountry)})`);
  }
  if (selectedFunctionRoot && selectedFunctionRoot !== 'fullcompany') {
    sliceParts.push(`by function (e.g. ${formatLabel(selectedFunctionRoot)})`);
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
      >
        <StyledTitle>Your first org chart is free!</StyledTitle>
        <StyledNodeInfo>{headline}</StyledNodeInfo>
        <StyledText>
          Get the {companyDisplay} org chart — {sliceText}, sliced any way you
          want.
        </StyledText>
        <StyledText>
          Get names, titles, emails & phone numbers for this role and the rest
          of the org chart.
        </StyledText>
        <StyledButton href={signUpUrl} rel="noreferrer">
          Sign up!
        </StyledButton>
        <StyledButtonRow>
          <StyledCloseButton type="button" onClick={onClose}>
            Close
          </StyledCloseButton>
        </StyledButtonRow>
      </StyledModal>
    </StyledBackdrop>
  );
};
