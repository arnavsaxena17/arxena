import { AdvancedFilterCompositeSubFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterCompositeSubFieldSelectMenu';
import { AdvancedFilterFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterFieldSelectMenu';
import { AdvancedFilterRawJsonPathSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterRawJsonPathSelectMenu';
import { AdvancedFilterRelationTargetFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterRelationTargetFieldSelectMenu';
import { objectFilterDropdownIsSelectingCompositeFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingCompositeFieldComponentState';
import { objectFilterDropdownIsSelectingRawJsonPathComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRawJsonPathComponentState';
import { objectFilterDropdownIsSelectingRelationTargetFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRelationTargetFieldComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

type AdvancedFilterFieldSelectDropdownContentProps = {
  recordFilterId: string;
};

export const AdvancedFilterFieldSelectDropdownContent = ({
  recordFilterId,
}: AdvancedFilterFieldSelectDropdownContentProps) => {
  const objectFilterDropdownIsSelectingCompositeField =
    useAtomComponentStateValue(
      objectFilterDropdownIsSelectingCompositeFieldComponentState,
    );

  const objectFilterDropdownIsSelectingRelationTargetField =
    useAtomComponentStateValue(
      objectFilterDropdownIsSelectingRelationTargetFieldComponentState,
    );

  const objectFilterDropdownIsSelectingRawJsonPath =
    useAtomComponentStateValue(
      objectFilterDropdownIsSelectingRawJsonPathComponentState,
    );

  if (objectFilterDropdownIsSelectingRelationTargetField) {
    return (
      <AdvancedFilterRelationTargetFieldSelectMenu
        recordFilterId={recordFilterId}
      />
    );
  }

  if (objectFilterDropdownIsSelectingCompositeField) {
    return (
      <AdvancedFilterCompositeSubFieldSelectMenu
        recordFilterId={recordFilterId}
      />
    );
  }

  if (objectFilterDropdownIsSelectingRawJsonPath) {
    return (
      <AdvancedFilterRawJsonPathSelectMenu recordFilterId={recordFilterId} />
    );
  }

  return <AdvancedFilterFieldSelectMenu recordFilterId={recordFilterId} />;
};
