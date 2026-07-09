import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { createComponentStateV2 } from '@/ui/utilities/state/component-state/utils/createComponentStateV2';

export const objectFilterDropdownIsSelectingRelationTargetFieldComponentState =
  createComponentStateV2<boolean>({
    key: 'objectFilterDropdownIsSelectingRelationTargetFieldComponentState',
    defaultValue: false,
    componentInstanceContext: ObjectFilterDropdownComponentInstanceContext,
  });
