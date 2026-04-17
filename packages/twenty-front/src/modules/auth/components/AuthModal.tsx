import { Modal, ModalSize } from '@/ui/layout/modal/components/Modal';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import React from 'react';

const StyledContent = styled(Modal.Content)<{
  $verticalAlign: 'center' | 'start';
}>`
  align-items: ${({ $verticalAlign }) =>
    $verticalAlign === 'start' ? 'stretch' : 'center'};
  justify-content: ${({ $verticalAlign }) =>
    $verticalAlign === 'start' ? 'flex-start' : 'center'};
  ${({ $verticalAlign, theme }) =>
    $verticalAlign === 'start' &&
    css`
      flex: 1 1 auto;
      min-height: 0;
      padding: ${theme.spacing(2)} ${theme.spacing(5)} ${theme.spacing(4)};
    `}
`;

type AuthModalProps = {
  children: React.ReactNode;
  size?: ModalSize;
  /** When start, content aligns to the top so tall onboarding fits without a large empty band above. */
  contentVerticalAlign?: 'center' | 'start';
};

export const AuthModal = ({
  children,
  size = 'medium',
  contentVerticalAlign = 'center',
}: AuthModalProps) => (
  <Modal
    padding={'none'}
    modalVariant="primary"
    isBackdropPointerPassthrough
    size={size}
  >
    <ScrollWrapper
      contextProviderName="modalContent"
      componentInstanceId="scroll-wrapper-modal-content"
    >
      <StyledContent $verticalAlign={contentVerticalAlign}>
        {children}
      </StyledContent>
    </ScrollWrapper>
  </Modal>
);
