import { useSelectedRecordIdOrThrow } from '@/action-menu/actions/record-actions/single-record/hooks/useSelectedRecordIdOrThrow';
import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { isDefined } from 'twenty-shared';

export const useViewAttachmentsChatAction: ActionHookWithObjectMetadataItem = ({
  objectMetadataItem,
}) => {
  const recordId = useSelectedRecordIdOrThrow();

  const shouldBeRegistered = isDefined(objectMetadataItem) && isDefined(recordId);

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }

    console.log('Opening attachment panel for record:', recordId);
    
    const event = new CustomEvent('openAttachmentPanel', {
      detail: {
        recordId,
      },
    });
    
    window.dispatchEvent(event);
  };

  return {
    shouldBeRegistered,
    onClick,
  };
}; 