import styled from '@emotion/styled';
import { IconX } from '@tabler/icons-react';

import { type OrgChartNodeData } from 'twenty-shared';

import { OrgChartSignUpIntro } from './OrgChartSignUpIntro';

const StyledBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
`;

const StyledDialog = styled.div`
  position: relative;
  width: 100%;
  max-width: 440px;
  max-height: min(92vh, 900px);
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
`;

const StyledCloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #818181;
  cursor: pointer;

  &:hover {
    background: rgba(20, 20, 20, 0.06);
    color: #141414;
  }

  &:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
  }
`;

export type OrgChartSignUpModalProps = {
  node: OrgChartNodeData | null;
  onClose: () => void;
  signUpUrl?: string;
  signUpCtaLabel?: string;
  onSignUpClick?: () => void;
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

export const OrgChartSignUpModal = ({
  node,
  onClose,
  signUpUrl = '/welcome',
  signUpCtaLabel = 'Sign up!',
  onSignUpClick,
  companyName,
  selectedCountry,
  selectedFunctionRoot,
}: OrgChartSignUpModalProps) => {
  if (!node) return null;

  return (
    <StyledBackdrop onClick={onClose} role="presentation">
      <StyledDialog
        onClick={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orgchart-signup-modal-title"
      >
        <StyledCloseButton
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <IconX size={20} stroke={1.75} />
        </StyledCloseButton>
        <OrgChartSignUpIntro
          node={node}
          titleId="orgchart-signup-modal-title"
          companyName={companyName}
          selectedCountry={selectedCountry}
          selectedFunctionRoot={selectedFunctionRoot}
          ctaLabel={signUpCtaLabel}
          signUpUrl={signUpUrl}
          onCtaClick={onSignUpClick}
          onDismiss={onClose}
        />
      </StyledDialog>
    </StyledBackdrop>
  );
};
