import { RegisterRecordActionEffect } from '@/action-menu/actions/record-actions/components/RegisterRecordActionEffect';
import { getActionViewType } from '@/action-menu/actions/utils/getActionViewType';
import { CHAT_ACTIONS_CONFIG } from '@/activities/chats/constants/ChatActionsConfig';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { isDefined } from 'twenty-shared';

export const ChatActionMenuEntriesSetter = () => {
  const contextStoreCurrentObjectMetadataItem = useRecoilComponentValueV2(
    contextStoreCurrentObjectMetadataItemComponentState,
  );

  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
  );

  const contextStoreCurrentViewType = useRecoilComponentValueV2(
    contextStoreCurrentViewTypeComponentState,
  );

  if (!isDefined(contextStoreCurrentObjectMetadataItem)) {
    return null;
  }

  const viewType = getActionViewType(
    contextStoreCurrentViewType,
    contextStoreTargetedRecordsRule,
  );
  
  console.log('ChatActionMenuEntriesSetter - contextStoreCurrentViewType:', contextStoreCurrentViewType);
  console.log('ChatActionMenuEntriesSetter - contextStoreTargetedRecordsRule:', contextStoreTargetedRecordsRule);
  console.log('ChatActionMenuEntriesSetter - viewType:', viewType);

  const actionsToRegister = isDefined(viewType)
    ? Object.values(CHAT_ACTIONS_CONFIG).filter((action) =>
        action.availableOn?.includes(viewType),
      )
    : [];
    
  console.log('ChatActionMenuEntriesSetter - actionsToRegister:', actionsToRegister);

  return (
    <>
      {actionsToRegister.map((action) => (
        <RegisterRecordActionEffect
          key={action.key}
          action={action}
          objectMetadataItem={contextStoreCurrentObjectMetadataItem}
        />
      ))}
    </>
  );
}; 