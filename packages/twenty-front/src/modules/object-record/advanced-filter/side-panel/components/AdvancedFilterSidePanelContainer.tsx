import { type ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { AdvancedFilterSidePanelCreateRootFilterButton } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelCreateRootFilterButton';
import { AdvancedFilterSidePanelRecordFilterColumn } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelRecordFilterColumn';
import { AdvancedFilterSidePanelRecordFilterGroupColumn } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelRecordFilterGroupColumn';
import { AdvancedFilterAddRecordFilterRuleSelect } from '@/object-record/advanced-filter/components/AdvancedFilterAddRecordFilterRuleSelect';
import { useChildRecordFiltersAndRecordFilterGroups } from '@/object-record/advanced-filter/hooks/useChildRecordFiltersAndRecordFilterGroups';
import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { rootLevelRecordFilterGroupComponentSelector } from '@/object-record/advanced-filter/states/rootLevelRecordFilterGroupComponentSelector';
import { isRecordFilterGroupChildARecordFilterGroup } from '@/object-record/advanced-filter/utils/isRecordFilterGroupChildARecordFilterGroup';
import { type VariablePickerComponent } from '@/object-record/record-field/form-types/types/VariablePickerComponent';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import styled from '@emotion/styled';
import { isDefined } from 'twenty-shared';

const StyledContainer = styled.div`
  align-items: start;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledChildContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(6)};
  width: 100%;
`;

export type AdvancedFilterSidePanelContainerProps = {
  readonly?: boolean;
  onUpdate?: () => void;
  objectMetadataItem: ObjectMetadataItem;
  VariablePicker?: VariablePickerComponent;
  isWorkflowFindRecords?: boolean;
  recordIndexId?: string;
};

export const AdvancedFilterSidePanelContainer = ({
  readonly,
  onUpdate,
  objectMetadataItem,
  VariablePicker,
  isWorkflowFindRecords,
  recordIndexId,
}: AdvancedFilterSidePanelContainerProps) => {
  const rootRecordFilterGroup = useRecoilComponentValueV2(
    rootLevelRecordFilterGroupComponentSelector,
  );

  const { childRecordFiltersAndRecordFilterGroups } =
    useChildRecordFiltersAndRecordFilterGroups({
      recordFilterGroupId: rootRecordFilterGroup?.id,
    });

  return (
    <AdvancedFilterContext.Provider
      value={{
        onUpdate: readonly ? undefined : onUpdate,
        isWorkflowFindRecords,
        recordIndexId,
        readonly,
        VariablePicker,
        objectMetadataItem,
      }}
    >
      {isDefined(rootRecordFilterGroup) ? (
        <StyledContainer>
          <StyledChildContainer>
            {childRecordFiltersAndRecordFilterGroups.map(
              (recordFilterGroupChild, recordFilterGroupChildIndex) =>
                isRecordFilterGroupChildARecordFilterGroup(
                  recordFilterGroupChild,
                ) ? (
                  <AdvancedFilterSidePanelRecordFilterGroupColumn
                    key={recordFilterGroupChild.id}
                    parentRecordFilterGroup={rootRecordFilterGroup}
                    recordFilterGroup={recordFilterGroupChild}
                    recordFilterGroupIndex={recordFilterGroupChildIndex}
                  />
                ) : (
                  <AdvancedFilterSidePanelRecordFilterColumn
                    key={recordFilterGroupChild.id}
                    recordFilterGroup={rootRecordFilterGroup}
                    recordFilter={recordFilterGroupChild}
                    recordFilterIndex={recordFilterGroupChildIndex}
                  />
                ),
            )}
          </StyledChildContainer>
          {!readonly && (
            <AdvancedFilterAddRecordFilterRuleSelect
              recordFilterGroup={rootRecordFilterGroup}
            />
          )}
        </StyledContainer>
      ) : (
        <AdvancedFilterSidePanelCreateRootFilterButton
          objectMetadataItem={objectMetadataItem}
        />
      )}
    </AdvancedFilterContext.Provider>
  );
};
