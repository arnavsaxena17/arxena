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

    // This would typically open the attachment panel for the selected record
    console.log('Opening attachment panel for record:', recordId);
    
    // In a real implementation, you might dispatch an event or use a state manager
    // to trigger the opening of the attachment panel with the selected record
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