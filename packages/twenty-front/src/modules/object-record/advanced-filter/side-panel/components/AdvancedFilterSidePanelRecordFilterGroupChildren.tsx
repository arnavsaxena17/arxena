import { AdvancedFilterSidePanelRecordFilterColumn } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelRecordFilterColumn';
import { AdvancedFilterAddFilterRuleSelect } from '@/object-record/advanced-filter/components/AdvancedFilterAddFilterRuleSelect';

import { useChildRecordFiltersAndRecordFilterGroups } from '@/object-record/advanced-filter/hooks/useChildRecordFiltersAndRecordFilterGroups';
import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import styled from '@emotion/styled';
import { useContext } from 'react';
import { isDefined } from 'twenty-shared';

const StyledContainer = styled.div<{ isGrayBackground?: boolean }>`
  align-items: start;
  background-color: ${({ isGrayBackground, theme }) =>
    isGrayBackground
      ? theme.background.transparent.lighter
      : 'transparent'};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(6)};
  padding: ${({ theme }) => theme.spacing(2)};
`;

type AdvancedFilterSidePanelRecordFilterGroupChildrenProps = {
  recordFilterGroupId: string;
};

export const AdvancedFilterSidePanelRecordFilterGroupChildren = ({
  recordFilterGroupId,
}: AdvancedFilterSidePanelRecordFilterGroupChildrenProps) => {
  const { readonly } = useContext(AdvancedFilterContext);
  const { currentRecordFilterGroup, childRecordFilters } =
    useChildRecordFiltersAndRecordFilterGroups({
      recordFilterGroupId,
    });

  if (!currentRecordFilterGroup) {
    return null;
  }

  const hasParentRecordFilterGroup = isDefined(
    currentRecordFilterGroup.parentRecordFilterGroupId,
  );

  return (
    <StyledContainer isGrayBackground={hasParentRecordFilterGroup}>
      {childRecordFilters.map((childRecordFilter, childRecordFilterIndex) => (
        <AdvancedFilterSidePanelRecordFilterColumn
          key={childRecordFilter.id}
          recordFilter={childRecordFilter}
          recordFilterIndex={childRecordFilterIndex}
          recordFilterGroup={currentRecordFilterGroup}
        />
      ))}
      {!readonly && (
        <AdvancedFilterAddFilterRuleSelect
          recordFilterGroup={currentRecordFilterGroup}
        />
      )}
    </StyledContainer>
  );
};
