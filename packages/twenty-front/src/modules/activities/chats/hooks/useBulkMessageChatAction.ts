import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { isDefined } from 'twenty-shared';

export const useBulkMessageChatAction: ActionHookWithObjectMetadataItem = ({
  objectMetadataItem,
}) => {
  console.log("useBulkMessageChatAction - has been clicked objectMetadataItem:", objectMetadataItem);
  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
  );

  const shouldBeRegistered =
    isDefined(objectMetadataItem) &&
    isDefined(contextStoreTargetedRecordsRule) &&
    contextStoreTargetedRecordsRule.mode === 'selection' &&
    contextStoreTargetedRecordsRule.selectedRecordIds.length > 0;

  const onClick = () => {
    console.log("useBulkMessageChatAction - onClick - shouldBeRegistered:", shouldBeRegistered);
    if (!shouldBeRegistered) {
      return;
    }

    console.log('Opening bulk message dialog for selected records:', contextStoreTargetedRecordsRule.selectedRecordIds);
    console.log('contextStoreTargetedRecordsRule:', contextStoreTargetedRecordsRule);
    console.log('objectMetadataItem:', objectMetadataItem);

    
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