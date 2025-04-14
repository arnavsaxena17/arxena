import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { isDefined } from 'twenty-shared';

export const useBulkMessageChatAction: ActionHookWithObjectMetadataItem = ({
  objectMetadataItem,
}) => {
  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
  );

  const shouldBeRegistered =
    isDefined(objectMetadataItem) &&
    isDefined(contextStoreTargetedRecordsRule) &&
    contextStoreTargetedRecordsRule.mode === 'selection' &&
    contextStoreTargetedRecordsRule.selectedRecordIds.length > 0;

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }

    // This would typically call the chat system to open a bulk message dialog
    // You would implement this based on your chat system's requirements
    console.log('Opening bulk message dialog for selected records:', contextStoreTargetedRecordsRule.selectedRecordIds);
    
    // In a real implementation, you might dispatch an event or use a state manager
    // to trigger the opening of the chat dialog with the selected records
    const event = new CustomEvent('openBulkChatDialog', {
      detail: {
        recordIds: contextStoreTargetedRecordsRule.selectedRecordIds,
      },
    });
    window.dispatchEvent(event);
  };

  return {
    shouldBeRegistered,
    onClick,
  };
}; 