import { enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { customSortState } from '@/candidate-table/states/customSortState';
import { processedDataSelector } from '@/candidate-table/states/states';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconChevronDown, IconSortAscending, IconSortDescending } from 'twenty-ui/icon';
import { useMemo, useState } from 'react';
import { type BaseSortField, type CustomSortState, type SortField } from '../types/sortTypes';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledSortContainer = styled.div`
  display: inline-block;
  position: relative;
`;

const StyledSortButton = styled.button`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 2px ${themeCssVariables.color.blue}20;
    outline: none;
  }
`;

const StyledDropdown = styled.div<{ isOpen: boolean }>`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: ${({ isOpen }) => (isOpen ? 'block' : 'none')};
  left: 0;
  min-width: 200px;
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 1000;
`;

const StyledDropdownItem = styled.div<{ isActive?: boolean }>`
  align-items: center;
  background-color: ${({ isActive }) =>
    isActive ? themeCssVariables.background.tertiary : 'transparent'};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }

  &:first-of-type {
    border-radius: ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.sm} 0 0;
  }

  &:last-of-type {
    border-radius: 0 0 ${themeCssVariables.border.radius.sm} ${themeCssVariables.border.radius.sm};
  }
`;

const StyledSortIcon = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;


const BASE_SORT_FIELDS: Array<{ field: BaseSortField; label: string }> = [
  { field: 'candConversationStatus', label: 'Conversation Status' },
  { field: 'startChat', label: 'Chat Started' },
  { field: 'startChatCompleted', label: 'Chat Completed' },
  { field: 'updatedAt', label: 'Last Updated' },
];

export const CustomSortDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sortState, setSortState] = useAtomState(customSortState) as [CustomSortState, (value: CustomSortState) => void];
  const enrichments = useAtomStateValue(enrichmentsState);
  const sampleEnrichments = useAtomStateValue(sampleEnrichmentsState);
  const processedData = useAtomStateValue(processedDataSelector);

  // Create dynamic sort fields including enrichment fields
  const sortFields = useMemo(() => {
    // Merge enrichments (same logic as in other components)
    const allAiFilters = [...enrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
      const exists = acc.find(item => item.modelName === current.modelName);
      if (!exists) {
        return [...acc, current];
      }
      return acc;
    }, []);

    // Get all possible field names from processed data
    const availableFieldNames = new Set<string>();
    if (processedData.length > 0) {
      processedData.forEach(candidate => {
        Object.keys(candidate).forEach(key => availableFieldNames.add(key));
      });
    }

    // Get enrichment fields that actually exist in the candidate data
    const aiFilterFields = allAiFilters.flatMap(aiFilter =>
      aiFilter.fields?.map((field: any) => ({
        field: field.name,
        label: field.name.charAt(0).toUpperCase() + field.name.slice(1)
      })).filter((fieldObj: any) =>
        availableFieldNames.has(fieldObj.field)
      ) || []
    );

    console.log("Available field names in processed data:", Array.from(availableFieldNames));
    console.log("AI filter fields that exist in data:", aiFilterFields);

    // Combine base fields and validated AI filter fields
    const combinedFields = [...BASE_SORT_FIELDS, ...aiFilterFields];
    console.log("Sort fields in dropdown:", combinedFields);
    return combinedFields;
  }, [enrichments, sampleEnrichments, processedData]);

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
    const currentField = sortFields.find(field => field.field === sortState.field);
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
        {sortFields.map((fieldOption, index) => (
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
