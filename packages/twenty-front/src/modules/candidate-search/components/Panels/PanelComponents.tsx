import styled from '@emotion/styled';
import { IconFilter, IconTable } from 'twenty-ui';

const StyledPanelContainer = styled.div`
  display: flex;
  height: calc(100% - 120px); /* Reserve space for action buttons */
  width: 100%;
`;

const StyledLeftPanel = styled.div`
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledCenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledRightPanel = styled.div`
  flex: 0 0 350px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

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

const StyledPanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
`;

type PanelProps = {
  children: React.ReactNode;
};

type PanelWithHeaderProps = {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
};

export const SearchFiltersPanel = ({ children }: PanelProps) => {
  return (
    <StyledLeftPanel>
      <StyledPanelHeader>
        <IconFilter size={20} />
        <StyledPanelTitle>Search Filters</StyledPanelTitle>
      </StyledPanelHeader>
      <StyledPanelContent>
        {children}
      </StyledPanelContent>
    </StyledLeftPanel>
  );
};

export const SearchResultsPanel = ({ children }: PanelProps) => {
  return (
    <StyledCenterPanel>
      <StyledPanelHeader>
        <IconTable size={20} />
        <StyledPanelTitle>Search Results</StyledPanelTitle>
      </StyledPanelHeader>
      <StyledPanelContent>
        {children}
      </StyledPanelContent>
    </StyledCenterPanel>
  );
};

export const AIChatPanel = ({ children }: PanelProps) => {
  return (
    <StyledRightPanel>
      {children}
    </StyledRightPanel>
  );
};

export const PanelContainer = ({ children }: PanelProps) => {
  return (
    <StyledPanelContainer>
      {children}
    </StyledPanelContainer>
  );
};
