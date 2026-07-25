import { useListenClickOutside } from '@/ui/utilities/pointer-event/hooks/useListenClickOutside';
import { styled } from '@linaria/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useIsMobile } from 'twenty-ui/utilities';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export type ModalSize = 'small' | 'medium' | 'large' | 'xl';
export type ModalPadding = 'none' | 'small' | 'medium' | 'large';

const MODAL_WIDTH_BY_SIZE: Record<ModalSize, string> = {
  small: '400px',
  medium: '640px',
  large: '840px',
  xl: '1080px',
};

const MODAL_PADDING_BY_SIZE: Record<ModalPadding, string> = {
  none: themeCssVariables.spacing[0],
  small: themeCssVariables.spacing[2],
  medium: themeCssVariables.spacing[4],
  large: themeCssVariables.spacing[6],
};

const StyledBackdrop = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.overlayPrimary};
  display: flex;
  height: 100%;
  justify-content: center;
  left: 0;
  position: fixed;
  top: 0;
  user-select: none;
  width: 100%;
  z-index: 9999;
`;

const StyledModalPanel = styled.div<{
  size: ModalSize;
  padding: ModalPadding;
  isMobile: boolean;
}>`
  background: ${themeCssVariables.background.primary};
  border-radius: ${({ isMobile }) =>
    isMobile ? '0' : themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-direction: column;
  height: ${({ isMobile }) => (isMobile ? '100dvh' : 'auto')};
  max-height: ${({ isMobile }) => (isMobile ? 'none' : '90dvh')};
  overflow-x: hidden;
  overflow-y: auto;
  padding: ${({ padding }) => MODAL_PADDING_BY_SIZE[padding]};
  width: ${({ isMobile, size }) =>
    isMobile ? '100%' : MODAL_WIDTH_BY_SIZE[size]};
  z-index: 10000;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  height: 60px;
  overflow: hidden;
  padding: ${themeCssVariables.spacing[5]};
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  padding: ${themeCssVariables.spacing[10]};
`;

const StyledFooter = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  height: 60px;
  overflow: hidden;
  padding: ${themeCssVariables.spacing[5]};
`;

type ModalSectionProps = {
  children: ReactNode;
  className?: string;
};

const ModalHeader = ({ children, className }: ModalSectionProps) => (
  <StyledHeader className={className}>{children}</StyledHeader>
);

const ModalContent = ({ children, className }: ModalSectionProps) => (
  <StyledContent className={className}>{children}</StyledContent>
);

const ModalFooter = ({ children, className }: ModalSectionProps) => (
  <StyledFooter className={className}>{children}</StyledFooter>
);

export type ModalProps = {
  children: ReactNode;
  size?: ModalSize;
  padding?: ModalPadding;
  className?: string;
  onEnter?: () => void;
} & (
  | { isClosable: true; onClose: () => void }
  | { isClosable?: false; onClose?: never }
);

const ModalRoot = ({
  children,
  size = 'medium',
  padding = 'medium',
  className,
  onEnter,
  isClosable = false,
  onClose,
}: ModalProps) => {
  const isMobile = useIsMobile();
  const modalRef = useRef<HTMLDivElement>(null);

  useListenClickOutside({
    refs: [modalRef],
    listenerId: 'MODAL_CLICK_OUTSIDE_LISTENER_ID',
    callback: () => {
      if (isClosable && onClose !== undefined) {
        onClose();
      }
    },
  });

  useEffect(() => {
    if (!isClosable || onClose === undefined) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'Enter') {
        onEnter?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClosable, onClose, onEnter]);

  const stopEventPropagation = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <StyledBackdrop className="modal-backdrop" onMouseDown={stopEventPropagation}>
      <StyledModalPanel
        ref={modalRef}
        size={size}
        padding={padding}
        className={className}
        isMobile={isMobile}
        onMouseDown={stopEventPropagation}
      >
        {children}
      </StyledModalPanel>
    </StyledBackdrop>
  );
};

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Content: ModalContent,
  Footer: ModalFooter,
});
