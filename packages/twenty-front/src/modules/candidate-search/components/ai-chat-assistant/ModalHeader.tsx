import { IconButton } from 'twenty-ui';
import { IconX } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 2px;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-left: 10px;
`;

type ModalHeaderProps = {
  title?: string;
  onClose: () => void;
};

export const ModalHeader = ({ title, onClose }: ModalHeaderProps) => {
  return (
    <StyledHeader>
      <StyledTitle>{title}</StyledTitle>
      <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
    </StyledHeader>
  );
};
