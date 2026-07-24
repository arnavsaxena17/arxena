import { SortConfig } from '@/candidate-table/states/states';
import styled from '@emotion/styled';
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from 'twenty-ui/icons';
import Handsontable from 'handsontable';
import { useState } from 'react';

const StyledSortingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.secondary};
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledSortingHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledSortingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSortingItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledColumnSelect = styled.select`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(1)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledOrderSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(1)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledSortButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(1)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    color: ${({ theme }) => theme.font.color.primary};
  }

  &.asc {
    color: ${({ theme }) => theme.color.blue};
  }

  &.desc {
    color: ${({ theme }) => theme.color.red};
  }
`;

const StyledRemoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(1)};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.xs};
  background-color: transparent;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.color.red};
  }
`;

const StyledAddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  background-color: transparent;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: ${({ theme }) => theme.font.size.sm};

  &:hover {
    border-color: ${({ theme }) => theme.color.blue};
    color: ${({ theme }) => theme.color.blue};
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledClearAllButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: ${({ theme }) => theme.font.size.sm};

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    color: ${({ theme }) => theme.color.red};
    border-color: ${({ theme }) => theme.color.red};
  }
`;

interface SortingControlsProps {
  columns: Handsontable.ColumnSettings[];
  sortConfig: SortConfig[];
  onSortChange: (sortConfig: SortConfig[]) => void;
  onClearSort: () => void;
}

export const SortingControls = ({
  columns,
  sortConfig,
  onSortChange,
  onClearSort,
}: SortingControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const addSortColumn = () => {
    // Find the first sortable column (skip checkbox)
    const firstSortableColumnIndex = columns.findIndex((col, index) => 
      index > 0 && col.title && col.data !== 'checkbox'
    );
    const defaultColumn = firstSortableColumnIndex >= 0 ? firstSortableColumnIndex : 1;
    
    const newSortConfig = [...sortConfig, { column: defaultColumn, sortOrder: 'asc' as const }];
    onSortChange(newSortConfig);
  };

  const removeSortColumn = (index: number) => {
    const newSortConfig = sortConfig.filter((_, i) => i !== index);
    onSortChange(newSortConfig);
  };

  const updateSortColumn = (index: number, column: number) => {
    const newSortConfig = [...sortConfig];
    newSortConfig[index] = { ...newSortConfig[index], column };
    onSortChange(newSortConfig);
  };

  const updateSortOrder = (index: number, sortOrder: 'asc' | 'desc') => {
    const newSortConfig = [...sortConfig];
    newSortConfig[index] = { ...newSortConfig[index], sortOrder };
    onSortChange(newSortConfig);
  };

  const toggleSortOrder = (index: number) => {
    const currentOrder = sortConfig[index].sortOrder;
    const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    updateSortOrder(index, newOrder);
  };

  const getColumnTitle = (columnIndex: number) => {
    const column = columns[columnIndex];
    if (!column) return `Column ${columnIndex}`;
    return column.title || `Column ${columnIndex}`;
  };

  // Filter out columns that shouldn't be sortable (like checkbox, etc.)
  const sortableColumns = columns.filter((col, index) => {
    // Skip checkbox column (usually index 0)
    if (index === 0 && col.data === 'checkbox') return false;
    // Skip columns without titles
    if (!col.title) return false;
    return true;
  });

  const getSortIcon = (sortOrder: 'asc' | 'desc') => {
    return sortOrder === 'asc' ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />;
  };

  if (!isExpanded && sortConfig.length === 0) {
    return (
      <StyledSortingContainer>
        <StyledAddButton onClick={() => setIsExpanded(true)}>
          <IconPlus size={16} />
          Add Sorting
        </StyledAddButton>
      </StyledSortingContainer>
    );
  }

  return (
    <StyledSortingContainer>
      <StyledSortingHeader>
        <span>Sorting ({sortConfig.length})</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {sortConfig.length > 0 && (
            <StyledClearAllButton onClick={onClearSort}>
              <IconX size={16} />
              Clear All
            </StyledClearAllButton>
          )}
          <StyledAddButton onClick={() => setIsExpanded(!isExpanded)}>
            <IconPlus size={16} />
            {isExpanded ? 'Collapse' : 'Add Sort'}
          </StyledAddButton>
        </div>
      </StyledSortingHeader>

      {isExpanded && (
        <StyledSortingList>
          {sortConfig.map((sort, index) => (
            <StyledSortingItem key={index}>
              <span style={{ fontSize: '12px', color: '#666' }}>{index + 1}.</span>
              <StyledColumnSelect
                value={sort.column}
                onChange={(e) => updateSortColumn(index, parseInt(e.target.value))}
              >
                {sortableColumns.map((col, colIndex) => {
                  // Find the actual column index in the full columns array
                  const actualIndex = columns.findIndex(fullCol => fullCol.data === col.data);
                  return (
                    <option key={actualIndex} value={actualIndex}>
                      {col.title}
                    </option>
                  );
                })}
              </StyledColumnSelect>
              <StyledSortButton
                className={sort.sortOrder}
                onClick={() => toggleSortOrder(index)}
                title={`Sort ${sort.sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {getSortIcon(sort.sortOrder)}
              </StyledSortButton>
              <StyledRemoveButton
                onClick={() => removeSortColumn(index)}
                title="Remove sort"
              >
                <IconX size={16} />
              </StyledRemoveButton>
            </StyledSortingItem>
          ))}
          
          {sortConfig.length < 3 && (
            <StyledAddButton onClick={addSortColumn}>
              <IconPlus size={16} />
              Add Sort Column
            </StyledAddButton>
          )}
        </StyledSortingList>
      )}
    </StyledSortingContainer>
  );
};
