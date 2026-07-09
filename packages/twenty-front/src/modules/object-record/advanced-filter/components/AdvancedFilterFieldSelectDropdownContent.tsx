import { AdvancedFilterCompositeSubFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterCompositeSubFieldSelectMenu';
import { AdvancedFilterFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterFieldSelectMenu';
import { AdvancedFilterRelationTargetFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterRelationTargetFieldSelectMenu';
import { objectFilterDropdownIsSelectingCompositeFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingCompositeFieldComponentState';
import { objectFilterDropdownIsSelectingRelationTargetFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRelationTargetFieldComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';

type AdvancedFilterFieldSelectDropdownContentProps = {
  recordFilterId: string;
};

export const AdvancedFilterFieldSelectDropdownContent = ({
  recordFilterId,
}: AdvancedFilterFieldSelectDropdownContentProps) => {
  const objectFilterDropdownIsSelectingCompositeField =
    useRecoilComponentValueV2(
      objectFilterDropdownIsSelectingCompositeFieldComponentState,
    );

  const objectFilterDropdownIsSelectingRelationTargetField =
    useRecoilComponentValueV2(
      objectFilterDropdownIsSelectingRelationTargetFieldComponentState,
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

  return <AdvancedFilterFieldSelectMenu recordFilterId={recordFilterId} />;
};
