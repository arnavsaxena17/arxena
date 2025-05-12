import { RegisterRecordActionEffect } from '@/action-menu/actions/record-actions/components/RegisterRecordActionEffect';
import { CHAT_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/ChatActionsConfig';
import { getActionViewType } from '@/action-menu/actions/utils/getActionViewType';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { isDefined } from 'twenty-shared';

export const ChatActionMenuEntriesSetter = () => {
  // console.log("ChatActionMenuEntriesSetter - CHAT_ACTIONS_CONFIG:", CHAT_ACTIONS_CONFIG);
  const instanceId = useAvailableComponentInstanceIdOrThrow(
    ContextStoreComponentInstanceContext,
  );

  // console.log("ChatActionMenuEntriesSetter - instanceId:", instanceId);
  const contextStoreCurrentObjectMetadataItem = useRecoilComponentValueV2(
    contextStoreCurrentObjectMetadataItemComponentState,
  );

  // console.log("ChatActionMenuEntriesSetter - contextStoreCurrentObjectMetadataItem:", contextStoreCurrentObjectMetadataItem);
  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
  );

  const contextStoreCurrentViewType = useRecoilComponentValueV2(
    contextStoreCurrentViewTypeComponentState,
  );

  // console.log("ChatActionMenuEntriesSetter - contextStoreTargetedRecordsRule:", contextStoreTargetedRecordsRule);

  if (!isDefined(contextStoreCurrentObjectMetadataItem)) {
    // console.log("ChatActionMenuEntriesSetter - contextStoreCurrentObjectMetadataItem is not defined");
    return null;
  }

  const viewType = getActionViewType(
    contextStoreCurrentViewType,
    contextStoreTargetedRecordsRule,
  );

  // console.log('Current viewType:', viewType);
  // console.log('Current objectMetadataItem:', contextStoreCurrentObjectMetadataItem);

  const actionsToRegister = isDefined(viewType)
    ? Object.values(CHAT_ACTIONS_CONFIG).filter((action) =>
        action.availableOn?.includes(viewType),
      )
    : [];

  // console.log('Actions to register:', actionsToRegister.map(a => ({ key: a.key, position: a.position })));

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