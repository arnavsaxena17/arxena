import { enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { customSortState } from '@/candidate-table/states/customSortState';
import { processedDataSelector } from '@/candidate-table/states/states';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconChevronDown, IconSortAscending, IconSortDescending } from 'twenty-ui/icon';
import { useMemo, useState } from 'react';
import { BaseSortField, CustomSortState, SortField } from '../types/sortTypes';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledSortContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledSortButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 2px ${themeCssVariables.color.blue}20;
  }
`;

const StyledDropdown = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  z-index: 1000;
  display: ${({ isOpen }) => (isOpen ? 'block' : 'none')};
  min-width: 200px;
`;

const StyledDropdownItem = styled.div<{ isActive?: boolean }>`
  padding: ${themeCssVariables.spacing[2]};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${themeCssVariables.font.size.sm};
  background-color: ${({ isActive }) => 
    isActive ? themeCssVariables.background.tertiary : 'transparent'};
  color: ${themeCssVariables.font.color.primary};

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
  display: flex;
  align-items: center;
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
  const customEnrichments = useAtomStateValue(enrichmentsState);
  const sampleEnrichments = useAtomStateValue(sampleEnrichmentsState);
  const processedData = useAtomStateValue(processedDataSelector);

  // Create dynamic sort fields including enrichment fields
  const sortFields = useMemo(() => {
    // Merge enrichments (same logic as in other components)
    const allAiFilters = [...customEnrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
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
  }, [customEnrichments, sampleEnrichments, processedData]);

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
