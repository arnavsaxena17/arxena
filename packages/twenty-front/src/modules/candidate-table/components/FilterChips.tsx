import { IconX } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { memo, useCallback } from 'react';

const StyledFilterChipsContainer = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} 0;
`;

const StyledFilterChip = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  max-width: 320px;
  min-width: 0;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease-in-out;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledClearButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: 50%;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 16px;
  justify-content: center;
  padding: 0;
  width: 16px;
  
  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    color: ${themeCssVariables.font.color.secondary};
  }
`;

const StyledClearAllButton = styled.button`
  align-items: center;
  background-color: ${themeCssVariables.color.red};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.inverted};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
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
