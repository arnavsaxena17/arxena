import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { selectedOperandInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/selectedOperandInDropdownComponentState';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useRecoilCallback } from 'recoil';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared';
import { v4 } from 'uuid';

export const useCreateRecordFilterFromObjectFilterDropdownCurrentStates =
  () => {
    const instanceId = useAvailableComponentInstanceIdOrThrow(
      ObjectFilterDropdownComponentInstanceContext,
    );

    const createRecordFilterFromObjectFilterDropdownCurrentStates =
      useRecoilCallback(
        ({ snapshot }) =>
          () => {
            const fieldMetadataItemUsedInDropdown = getSnapshotValue(
              snapshot,
              fieldMetadataItemUsedInDropdownComponentSelector.selectorFamily({
                instanceId,
              }),
            );

            const selectedOperandInDropdown = getSnapshotValue(
              snapshot,
              selectedOperandInDropdownComponentState.atomFamily({
                instanceId,
              }),
            );

            const subFieldNameUsedInDropdown = getSnapshotValue(
              snapshot,
              subFieldNameUsedInDropdownComponentState.atomFamily({
                instanceId,
              }),
            );

            if (!isDefined(fieldMetadataItemUsedInDropdown)) {
              throw new Error(
                'Field metadata item used in dropdown is not defined when creating a record filter from object filter dropdown current states.',
              );
            }

            const filterType = getFilterTypeFromFieldType(
              fieldMetadataItemUsedInDropdown.type,
            );

            if (!isDefined(selectedOperandInDropdown)) {
              throw new Error(
                'Selected operand in dropdown is not defined when creating a record filter from object filter dropdown current states.',
              );
            }

            const newRecordFilterFromObjectFilterDropdownStates: RecordFilter = {
              id: v4(),
              fieldMetadataId: fieldMetadataItemUsedInDropdown.id,
              operand: selectedOperandInDropdown,
              displayValue: '',
              label: fieldMetadataItemUsedInDropdown.label,
              type: filterType,
              value: '',
              subFieldName: subFieldNameUsedInDropdown,
            };

            return { newRecordFilterFromObjectFilterDropdownStates };
          },
        [instanceId],
      );

    return {
      createRecordFilterFromObjectFilterDropdownCurrentStates,
    };
  };
