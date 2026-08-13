import { type SortConfig } from '@/candidate-table/states/states';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from 'twenty-ui/icon';
import type Handsontable from 'handsontable';
import { useState } from 'react';

const StyledSortingContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledSortingHeader = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  justify-content: space-between;
`;

const StyledSortingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSortingItem = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.xs};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]};
`;

const StyledColumnSelect = styled.select`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]};
`;

const StyledOrderSelect = styled.select`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]};
`;

const StyledSortButton = styled.button`
  align-items: center;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: ${themeCssVariables.spacing[1]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    color: ${themeCssVariables.font.color.primary};
  }

  &.asc {
    color: ${themeCssVariables.color.blue};
  }

  &.desc {
    color: ${themeCssVariables.color.red};
  }
`;

const StyledRemoveButton = styled.button`
  align-items: center;
  background-color: transparent;
  border: none;
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: ${themeCssVariables.spacing[1]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    color: ${themeCssVariables.color.red};
  }
`;

const StyledAddButton = styled.button`
  align-items: center;
  background-color: transparent;
  border: 1px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.color.blue};
    color: ${themeCssVariables.color.blue};
  }
`;

const StyledClearAllButton = styled.button`
  align-items: center;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.color.red};
    color: ${themeCssVariables.color.red};
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
