import { useSelectedRecordId } from '@/action-menu/actions/record-actions/single-record/hooks/useSelectedRecordId';
import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { ActionMenuContext } from '@/action-menu/contexts/ActionMenuContext';
import { useRecordShowPagePagination } from '@/object-record/record-show/hooks/useRecordShowPagePagination';
import { useContext } from 'react';
import { isDefined } from 'twenty-shared';

export const useNavigateToNextRecordSingleRecordAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const recordId = useSelectedRecordId();

    const { isInRightDrawer } = useContext(ActionMenuContext);

    const { navigateToNextRecord } = useRecordShowPagePagination(
      objectMetadataItem.nameSingular,
      recordId || '00000000-0000-0000-0000-000000000000',
    );

    return {
      shouldBeRegistered: !isInRightDrawer && isDefined(recordId),
      onClick: navigateToNextRecord,
    };
  };
