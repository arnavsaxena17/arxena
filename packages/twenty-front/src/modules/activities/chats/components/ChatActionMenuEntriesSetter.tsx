import { RegisterRecordActionEffect } from '@/action-menu/actions/record-actions/components/RegisterRecordActionEffect';
import { getActionViewType } from '@/action-menu/actions/utils/getActionViewType';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { CHAT_ACTIONS_CONFIG } from '@/activities/chats/constants/ChatActionsConfig';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { isDefined } from 'twenty-shared';

export const ChatActionMenuEntriesSetter = () => {
  const instanceId = useAvailableComponentInstanceIdOrThrow(
    ContextStoreComponentInstanceContext,
  );


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
  console.log("ChatActionMenuEntriesSetter - contextStoreCurrentObjectMetadataItem:", contextStoreCurrentObjectMetadataItem);
  console.log("ChatActionMenuEntriesSetter - contextStoreTargetedRecordsRule:", contextStoreTargetedRecordsRule);
  console.log("ChatActionMenuEntriesSetter - contextStoreCurrentViewType:", contextStoreCurrentViewType);
  console.log("ChatActionMenuEntriesSetter - viewType:", viewType);

  const actionsToRegister = isDefined(viewType)
    ? Object.values(CHAT_ACTIONS_CONFIG).filter((action) =>
        action.availableOn?.includes(viewType),
      )
    : [];
    
  
  // Log each action's availability for the current viewType
  if (isDefined(viewType)) {
    Object.entries(CHAT_ACTIONS_CONFIG).forEach(([key, action]) => {
      console.log(` Chat actions config for ${key}: ${action.availableOn?.includes(viewType)}`);
    });
  }

  return (
    <ActionMenuComponentInstanceContext.Provider
      value={{
        instanceId: instanceId,
      }}
    >
      {actionsToRegister.map((action) => (
        <RegisterRecordActionEffect
          key={action.key}
          action={action}
          objectMetadataItem={contextStoreCurrentObjectMetadataItem}
        />
      ))}
    </ActionMenuComponentInstanceContext.Provider>
  );
}; 