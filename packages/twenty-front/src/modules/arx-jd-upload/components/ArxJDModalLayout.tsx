import { ReactNode } from 'react';
import { IconButton, IconX } from 'twenty-ui';

import {
    StyledAdjuster,
    StyledBackdrop,
    StyledBody,
    StyledFooter,
    StyledModal,
    StyledModalContainer,
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
};

export const ArxJDModalLayout = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
}: ArxJDModalLayoutProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <StyledBackdrop
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <StyledAdjuster
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <StyledModal
          onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          onMouseDown={(e: React.MouseEvent<HTMLDivElement>) =>
            e.stopPropagation()
          }
          onMouseUp={(e: React.MouseEvent<HTMLDivElement>) =>
            e.stopPropagation()
          }
          onMouseMove={(e: React.MouseEvent<HTMLDivElement>) =>
            e.stopPropagation()
          }
        >
          <StyledModalContainer
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
            onMouseDown={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
            onMouseUp={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
            onMouseMove={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
          >
            <StyledModalContent
              onClick={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
              onMouseDown={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
              onMouseUp={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
              onMouseMove={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
            >
              <StyledModalHeader>
                <StyledTitle>{title}</StyledTitle>
                <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
              </StyledModalHeader>
              <StyledScrollableContent>
                <StyledBody>{children}</StyledBody>
              </StyledScrollableContent>
              {footer && <StyledFooter>{footer}</StyledFooter>}
            </StyledModalContent>
          </StyledModalContainer>
        </StyledModal>
      </StyledAdjuster>
    </StyledBackdrop>
  );
};
