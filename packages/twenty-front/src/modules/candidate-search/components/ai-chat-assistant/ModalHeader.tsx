import { IconButton } from 'twenty-ui';
import { IconX } from 'twenty-ui/icons';
import styled from '@emotion/styled';

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 2px;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
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
