import { customSortState } from '@/candidate-table/states/customSortState';
import styled from '@emotion/styled';
import { IconChevronDown, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import { CustomSortState, SortField } from '../types/sortTypes';

const StyledSortContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledSortButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    border-color: ${({ theme }) => theme.border.color.strong};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue}20;
  }
`;

const StyledDropdown = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: 1000;
  display: ${({ isOpen }) => (isOpen ? 'block' : 'none')};
  min-width: 200px;
`;

const StyledDropdownItem = styled.div<{ isActive?: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ isActive, theme }) => 
    isActive ? theme.background.tertiary : 'transparent'};
  color: ${({ theme }) => theme.font.color.primary};

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }

  &:first-of-type {
    border-radius: ${({ theme }) => theme.border.radius.sm} ${({ theme }) => theme.border.radius.sm} 0 0;
  }

  &:last-of-type {
    border-radius: 0 0 ${({ theme }) => theme.border.radius.sm} ${({ theme }) => theme.border.radius.sm};
  }
`;

const StyledSortIcon = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;


const SORT_FIELDS: Array<{ field: SortField; label: string }> = [
  { field: 'candConversationStatus', label: 'Conversation Status' },
  { field: 'startChat', label: 'Chat Started' },
  { field: 'startChatCompleted', label: 'Chat Completed' },
  { field: 'updatedAt', label: 'Last Updated' },
];

export const CustomSortDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sortState, setSortState] = useRecoilState(customSortState) as [CustomSortState, (value: CustomSortState) => void];

  const handleSortSelect = (field: SortField) => {
    // If clicking the same field, toggle direction
    if (sortState.field === field) {
      setSortState({
        field,
        direction: sortState.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      // If clicking a different field, set to ascending by default
      setSortState({
        field,
        direction: 'asc',
      });
    }
    setIsOpen(false);
  };

  const getCurrentSortLabel = () => {
    const currentField = SORT_FIELDS.find(field => field.field === sortState.field);
    return currentField?.label || 'Sort by...';
  };

  const getSortIcon = () => {
    return sortState.direction === 'asc' ? 
      <IconSortAscending size={16} /> : 
      <IconSortDescending size={16} />;
  };

  return (
    <StyledSortContainer>
      <StyledSortButton 
        onClick={() => setIsOpen(!isOpen)}
        title={`Click to change field, click same field to toggle ${sortState.direction === 'asc' ? 'descending' : 'ascending'}`}
      >
        <StyledSortIcon>
          {getSortIcon()}
          {getCurrentSortLabel()}
        </StyledSortIcon>
        <IconChevronDown size={16} />
      </StyledSortButton>
      
      <StyledDropdown isOpen={isOpen}>
        {SORT_FIELDS.map((fieldOption, index) => (
          <StyledDropdownItem
            key={index}
            isActive={sortState.field === fieldOption.field}
            onClick={() => handleSortSelect(fieldOption.field)}
            title={sortState.field === fieldOption.field ? 
              `Currently sorted ${sortState.direction === 'asc' ? 'ascending' : 'descending'}. Click to toggle.` : 
              'Click to sort by this field'
            }
          >
            <span>{fieldOption.label}</span>
            {sortState.field === fieldOption.field && (
              sortState.direction === 'asc' ? 
                <IconSortAscending size={16} /> : 
                <IconSortDescending size={16} />
            )}
          </StyledDropdownItem>
        ))}
      </StyledDropdown>
    </StyledSortContainer>
  );
};
