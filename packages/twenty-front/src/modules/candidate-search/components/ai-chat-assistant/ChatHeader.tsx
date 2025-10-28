import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';
import { IconHistory, IconRobot, IconX } from 'twenty-ui';

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledHeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledCurrentFilterBadge = styled.div`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const StyledClearButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledDropdownContainer = styled.div`
  position: relative;
`;

const StyledHistoryButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(1)});
  right: 0;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
`;

const StyledDropdownItem = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  border: none;
  background-color: transparent;
  text-align: left;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: background-color 0.15s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  }
`;

const StyledDropdownItemName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledDropdownItemInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

type SearchFilter = {
  id: string;
  name: string;
  searchFilterName?: string | null;
};

type ChatHeaderProps = {
  title?: string;
  onClearChat?: () => void;
  searchFilters?: SearchFilter[];
  currentSearchFilterId?: string;
  onSearchFilterSelect?: (searchFilterId: string) => void;
};

export const ChatHeader = ({ 
  title = 'Arx Search Assistant', 
  onClearChat,
  searchFilters = [],
  currentSearchFilterId,
  onSearchFilterSelect
}: ChatHeaderProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleSearchFilterClick = (searchFilterId: string) => {
    if (onSearchFilterSelect) {
      onSearchFilterSelect(searchFilterId);
    }
    setIsDropdownOpen(false);
  };

  // Find the current filter to display its name
  const currentFilter = searchFilters.find(f => f.id === currentSearchFilterId);
  const currentFilterName = currentFilter?.searchFilterName || currentFilter?.name || 'No filter selected';
  const currentFilterId = currentFilter?.id || 'No filter selected';
  return (
    <StyledPanelHeader>
      <StyledHeaderContent>
        <IconRobot size={20} />
        <StyledPanelTitle>{title}</StyledPanelTitle>
        {currentSearchFilterId && (
          <StyledCurrentFilterBadge title={currentFilterId}>
            {currentFilterId.slice(0, 10)}...
          </StyledCurrentFilterBadge>
        )}
      </StyledHeaderContent>
      <StyledHeaderActions>
        {searchFilters.length > 0 && (
          <StyledDropdownContainer ref={dropdownRef}>
            <StyledHistoryButton
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              title="Search filter history"
            >
              <IconHistory size={16} />
              History
            </StyledHistoryButton>
            {isDropdownOpen && (
              <StyledDropdown>
                {searchFilters.map((filter) => (
                  <StyledDropdownItem
                    key={filter.id}
                    onClick={() => handleSearchFilterClick(filter.id)}
                    style={{
                      backgroundColor: filter.id === currentSearchFilterId 
                        ? 'rgba(0, 0, 0, 0.05)' 
                        : 'transparent'
                    }}
                  >
                    <StyledDropdownItemName>
                      {filter.searchFilterName || filter.name || `Filter ${filter.id.slice(0, 8)}`}
                    </StyledDropdownItemName>
                    <StyledDropdownItemInfo>
                      ID: {filter.id.slice(0, 20)}...
                    </StyledDropdownItemInfo>
                  </StyledDropdownItem>
                ))}
              </StyledDropdown>
            )}
          </StyledDropdownContainer>
        )}
        {onClearChat && (
          <StyledClearButton onClick={onClearChat} title="Clear chat history">
            <IconX size={16} />
            Clear
          </StyledClearButton>
        )}
      </StyledHeaderActions>
    </StyledPanelHeader>
  );
};
