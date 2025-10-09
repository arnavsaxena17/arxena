import styled from '@emotion/styled';
import { IconRobot } from 'twenty-ui';

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

type ChatHeaderProps = {
  title?: string;
};

export const ChatHeader = ({ title = 'AI Search Assistant' }: ChatHeaderProps) => {
  return (
    <StyledPanelHeader>
      <IconRobot size={20} />
      <StyledPanelTitle>{title}</StyledPanelTitle>
    </StyledPanelHeader>
  );
};
