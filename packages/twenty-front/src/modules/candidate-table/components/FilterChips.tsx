import { IconX } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { memo, useCallback } from 'react';

const StyledFilterChipsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} 0;
`;

const StyledFilterChip = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  max-width: 320px;
  min-width: 0;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: ${themeCssVariables.font.color.tertiary};
  border-radius: 50%;
  width: 16px;
  height: 16px;
  
  &:hover {
    color: ${themeCssVariables.font.color.secondary};
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledClearAllButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.red};
  color: ${themeCssVariables.font.color.inverted};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${themeCssVariables.color.red10};
  }
`;

export interface FilterCondition {
  column: number;
  conditions: Array<{
    name: string;
    args: any[];
  }>;
  operation: string;
}

export interface FilterChipsProps {
  activeFilters: FilterCondition[];
  columns: Array<{ title: string; data: string }>;
  onRemoveFilter: (columnIndex: number) => void;
  onClearAllFilters: () => void;
}

const MAX_VISIBLE_FILTER_VALUES = 2;

const formatValueList = (values: string[]): string => {
  if (values.length <= MAX_VISIBLE_FILTER_VALUES) {
    return values.join(', ');
  }

  return `${values.slice(0, MAX_VISIBLE_FILTER_VALUES).join(', ')} +${values.length - MAX_VISIBLE_FILTER_VALUES} more`;
};

const formatFilterValue = (condition: FilterCondition, columns: Array<{ title: string; data: string }>): string => {
  const columnTitle = columns[condition.column]?.title || `Column ${condition.column}`;
  
  if (condition.conditions.length === 0) {
    return `${columnTitle}: No conditions`;
  }

  const conditionTexts = condition.conditions.map(cond => {
    switch (cond.name) {
      case 'by_value': {
        const rawValues = Array.isArray(cond.args[0]) ? cond.args[0] : [cond.args[0]];
        const values = rawValues.map(String).filter((value) => value.length > 0);

        if (values.length === 0) {
          return 'Active';
        }
        if (values.length === 1) {
          return `is "${values[0]}"`;
        }
        return `in [${formatValueList(values)}]`;
      }
      
      case 'contains':
        return `contains "${cond.args[0]}"`;
      
      case 'empty':
        return 'is empty';
      
      case 'not_empty':
        return 'is not empty';
      
      case 'begins_with':
        return `starts with "${cond.args[0]}"`;
      
      case 'ends_with':
        return `ends with "${cond.args[0]}"`;
      
      case 'by_condition':
        return `matches condition "${cond.args[0]}"`;
      
      default:
        return `${cond.name}: ${cond.args.join(', ')}`;
    }
  });

  return `${columnTitle} ${conditionTexts.join(` ${condition.operation} `)}`;
};

export const FilterChips = memo<FilterChipsProps>(({
  activeFilters,
  columns,
  onRemoveFilter,
  onClearAllFilters
}) => {
  const handleRemoveFilter = useCallback((columnIndex: number) => {
    console.log('FilterChips: handleRemoveFilter called with columnIndex:', columnIndex);
    onRemoveFilter(columnIndex);
  }, [onRemoveFilter]);

  if (!activeFilters || activeFilters.length === 0) {
    return null;
  }

  return (
    <StyledFilterChipsContainer>
      {activeFilters.map((filter, index) => {
        const label = formatFilterValue(filter, columns);

        return (
          <StyledFilterChip key={`${filter.column}-${index}`} title={label}>
            <span>{label}</span>
            <StyledClearButton
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFilter(filter.column);
              }}
              title="Remove filter"
            >
              <IconX size={12} />
            </StyledClearButton>
          </StyledFilterChip>
        );
      })}
      
      {activeFilters.length > 1 && (
        <StyledClearAllButton
          onClick={() => {
            console.log('FilterChips: Clear all filters clicked');
            onClearAllFilters();
          }}
          title="Clear all filters"
        >
          Clear All
          <IconX size={12} />
        </StyledClearAllButton>
      )}
    </StyledFilterChipsContainer>
  );
});
