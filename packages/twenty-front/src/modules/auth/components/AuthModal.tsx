import { Modal, ModalSize } from '@/ui/layout/modal/components/Modal';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import React from 'react';

const StyledContent = styled(Modal.Content)`
  align-items: center;
  justify-content: center;
`;

type AuthModalProps = {
  children: React.ReactNode;
  size?: ModalSize;
};

export const AuthModal = ({ children, size = 'medium' }: AuthModalProps) => (
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
      <StyledContent>{children}</StyledContent>
    </ScrollWrapper>
  </Modal>
);
