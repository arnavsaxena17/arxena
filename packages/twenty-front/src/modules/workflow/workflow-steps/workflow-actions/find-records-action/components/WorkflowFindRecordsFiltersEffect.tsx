import { useSetAdvancedFilterDropdownStates } from '@/object-record/advanced-filter/hooks/useSetAdvancedFilterDropdownAllRowsStates';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useRecoilComponentFamilyStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentFamilyStateV2';
import { ensureRecordFilterGroupsForFilters } from '@/workflow/workflow-steps/workflow-actions/find-records-action/utils/workflowFindRecordsFilterUtils';
import { hasInitializedCurrentRecordFilterGroupsComponentFamilyState } from '@/views/states/hasInitializedCurrentRecordFilterGroupsComponentFamilyState';
import { hasInitializedCurrentRecordFiltersComponentFamilyState } from '@/views/states/hasInitializedCurrentRecordFiltersComponentFamilyState';
import { WorkflowFindRecordsFilter } from '@/workflow/workflow-steps/workflow-actions/find-records-action/utils/workflowFindRecordsFilterUtils';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const WorkflowFindRecordsFiltersEffect = ({
  defaultValue,
}: {
  defaultValue?: WorkflowFindRecordsFilter;
}) => {
  const [
    hasInitializedCurrentRecordFilters,
    setHasInitializedCurrentRecordFilters,
  ] = useRecoilComponentFamilyStateV2(
    hasInitializedCurrentRecordFiltersComponentFamilyState,
    {},
  );

  const [
    hasInitializedCurrentRecordFilterGroups,
    setHasInitializedCurrentRecordFilterGroups,
  ] = useRecoilComponentFamilyStateV2(
    hasInitializedCurrentRecordFilterGroupsComponentFamilyState,
    {},
  );

  const setCurrentRecordFilters = useSetRecoilComponentStateV2(
    currentRecordFiltersComponentState,
  );

  const setCurrentRecordFilterGroups = useSetRecoilComponentStateV2(
    currentRecordFilterGroupsComponentState,
  );

  const { setAdvancedFilterDropdownStates } =
    useSetAdvancedFilterDropdownStates();

  const [
    shouldSetAdvancedFilterDropdownStates,
    setShouldSetAdvancedFilterDropdownStates,
  ] = useState(false);

  useEffect(() => {
    if (
      hasInitializedCurrentRecordFilters &&
      hasInitializedCurrentRecordFilterGroups
    ) {
      return;
    }

    if (!isDefined(defaultValue?.recordFilters)) {
      return;
    }

    const { recordFilters, recordFilterGroups } =
      ensureRecordFilterGroupsForFilters({
        recordFilters: defaultValue.recordFilters ?? [],
        recordFilterGroups: defaultValue.recordFilterGroups ?? [],
      });

    if (!hasInitializedCurrentRecordFilters) {
      setCurrentRecordFilters(recordFilters);
      setHasInitializedCurrentRecordFilters(true);
      setShouldSetAdvancedFilterDropdownStates(true);
    }

    if (!hasInitializedCurrentRecordFilterGroups) {
      setCurrentRecordFilterGroups(recordFilterGroups);
      setHasInitializedCurrentRecordFilterGroups(true);
    }
  }, [
    defaultValue?.recordFilterGroups,
    defaultValue?.recordFilters,
    hasInitializedCurrentRecordFilterGroups,
    hasInitializedCurrentRecordFilters,
    setCurrentRecordFilterGroups,
    setCurrentRecordFilters,
    setHasInitializedCurrentRecordFilterGroups,
    setHasInitializedCurrentRecordFilters,
  ]);

  useEffect(() => {
    if (shouldSetAdvancedFilterDropdownStates) {
      setAdvancedFilterDropdownStates();
      setShouldSetAdvancedFilterDropdownStates(false);
    }
  }, [shouldSetAdvancedFilterDropdownStates, setAdvancedFilterDropdownStates]);

  return null;
};
