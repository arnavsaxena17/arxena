import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { WorkflowFindRecordsFilter } from '@/workflow/workflow-steps/workflow-actions/find-records-action/utils/workflowFindRecordsFilterUtils';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { AdvancedFilterSidePanelContainer } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelContainer';
import { useRecoilCallback } from 'recoil';

export const WorkflowFindRecordsFilters = ({
  objectMetadataItem,
  onChange,
  readonly,
}: {
  objectMetadataItem: ObjectMetadataItem;
  onChange: (filter: WorkflowFindRecordsFilter) => void;
  readonly?: boolean;
}) => {
  const currentRecordFilterGroupsCallbackState =
    useRecoilComponentCallbackStateV2(currentRecordFilterGroupsComponentState);
  const currentRecordFiltersCallbackState = useRecoilComponentCallbackStateV2(
    currentRecordFiltersComponentState,
  );

  const onUpdate = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        const existingRecordFilterGroups = getSnapshotValue(
          snapshot,
          currentRecordFilterGroupsCallbackState,
        );
        const existingRecordFilters = getSnapshotValue(
          snapshot,
          currentRecordFiltersCallbackState,
        );

        onChange({
          recordFilterGroups: existingRecordFilterGroups,
          recordFilters: existingRecordFilters,
        });
      },
    [
      currentRecordFilterGroupsCallbackState,
      currentRecordFiltersCallbackState,
      onChange,
    ],
  );

  return (
    <AdvancedFilterSidePanelContainer
      objectMetadataItem={objectMetadataItem}
      onUpdate={readonly ? undefined : onUpdate}
      VariablePicker={WorkflowVariablePicker}
      readonly={readonly}
      isWorkflowFindRecords={true}
    />
  );
};
