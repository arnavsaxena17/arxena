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
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledNodeInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
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
};

export const OrgChartSignUpModal = ({
  node,
  onClose,
  signUpUrl = '/sign-up',
}: OrgChartSignUpModalProps) => {
  if (!node) return null;

  const headline = node.headline ?? 'Unknown';
  const names: string[] = [];
  for (let i = 0; i < 4; i++) {
    const name = node[`name_${i}`];
    if (typeof name === 'string' && name.trim()) {
      names.push(name);
    }
  }

  return (
    <StyledBackdrop onClick={onClose}>
      <StyledModal
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <StyledTitle>Sign up for your free org chart</StyledTitle>
        <StyledNodeInfo>{headline}</StyledNodeInfo>
        {names.length > 0 && (
          <StyledText>
            See names, titles, emails & phone numbers for this role and the rest
            of the org chart.
          </StyledText>
        )}
        <StyledButton href={signUpUrl} rel="noreferrer">
          Continue with LinkedIn / Google / Email
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
