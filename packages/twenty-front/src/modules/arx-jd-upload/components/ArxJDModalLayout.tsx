import { IconButton } from 'twenty-ui/input';
import { IconX } from 'twenty-ui/icon';
import { type ReactNode } from 'react';

import {
  StyledAdjuster,
  StyledBackdrop,
  StyledBody,
  StyledFooter,
  StyledModal,
  StyledModalContent,
  StyledModalHeader,
  StyledScrollableContent,
  StyledTitle,
} from './ArxJDUploadModal.styled';

type ArxJDModalLayoutProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  navigation?: ReactNode;
};

export const ArxJDModalLayout = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
  navigation,
}: ArxJDModalLayoutProps) => {
  if (!isOpen) {
    return null;
  }

  const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <StyledBackdrop onClick={onClose}>
      <StyledAdjuster onClick={stopPropagation}>
        <StyledModal onClick={stopPropagation} onMouseDown={stopPropagation}>
          <StyledModalContent onClick={stopPropagation}>
            <StyledModalHeader>
              <StyledTitle>{title}</StyledTitle>
              <IconButton
                Icon={IconX}
                onClick={onClose}
                variant="tertiary"
                size="small"
              />
            </StyledModalHeader>
            <StyledScrollableContent>
              <StyledBody>{children}</StyledBody>
            </StyledScrollableContent>
            {navigation && (
              <StyledFooter onClick={stopPropagation}>{navigation}</StyledFooter>
            )}
            {footer && <StyledFooter>{footer}</StyledFooter>}
          </StyledModalContent>
        </StyledModal>
      </StyledAdjuster>
    </StyledBackdrop>
  );
};
