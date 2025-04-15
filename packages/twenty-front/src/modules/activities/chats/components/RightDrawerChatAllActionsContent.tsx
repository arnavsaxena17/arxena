import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import { ActionMenuContext } from '@/action-menu/contexts/ActionMenuContext';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { CHAT_ACTIONS_CONFIG } from '@/activities/chats/constants/ChatActionsConfig';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import styled from '@emotion/styled';
import { i18n, MessageDescriptor } from '@lingui/core';
import React, { useEffect, useState } from 'react';
import { IconComponent, MenuItemCommand } from 'twenty-ui';

// Define action types
type ActionHook = (params: { objectMetadataItem: any }) => {
  onClick: () => void;
  shouldBeRegistered?: boolean;
  ConfirmationModal?: React.ReactNode;
};

// Update the ChatAction type to match the actual structure
type ChatAction = {
  key: string;
  label: MessageDescriptor | string;
  Icon: IconComponent;
  isPinned?: boolean;
  useAction?: ActionHook;
  availableOn?: ActionViewType[];
};

// Create a singleton to share the selected IDs between components
export const chatActionsState = {
  selectedRecordIds: [] as string[]
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledGroupHeading = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  padding-bottom: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(2)};
  padding-right: ${({ theme }) => theme.spacing(1)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  user-select: none;
`;

const StyledGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

// Helper function to handle i18n for both string and MessageDescriptor
const translate = (label: MessageDescriptor | string): string => {
  if (typeof label === 'string') {
    return label;
  }
  return i18n._(label);
};

// Create ActionItem component to properly use hooks for each action
const ActionItem = ({ action }: { action: ChatAction }) => {
  // Call the action's hook properly within a React component
  const actionResult = action.useAction ? 
    action.useAction({
      objectMetadataItem: {
        id: 'candidate-id',
        nameSingular: 'candidate',
        namePlural: 'candidates',
        labelSingular: 'Candidate',
        labelPlural: 'Candidates',
        description: 'Candidate records',
        icon: 'IconUser',
        isCustom: false,
        isRemote: false,
        isActive: true,
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        labelIdentifierFieldMetadataId: 'name-field-id',
        imageIdentifierFieldMetadataId: null,
        isLabelSyncedWithName: true,
        fields: [],
        indexMetadatas: []
      }
    }) : null;

  const handleClick = () => {
    if (actionResult?.onClick) {
      actionResult.onClick();
    } else {
      console.log(`Action ${action.key} clicked but no onClick handler found`);
    }
  };

  return (
    <>
      <MenuItemCommand
        LeftIcon={action.Icon}
        text={translate(action.label)}
        onClick={handleClick}
      />
      {actionResult?.ConfirmationModal && actionResult.ConfirmationModal}
    </>
  );
};

// Create a CommandGroup-like component for consistency
const ActionGroup = ({ heading, children }: { heading: string, children: React.ReactNode }) => {
  if (!children || !React.Children.count(children)) {
    return null;
  }
  return (
    <>
      <StyledGroupHeading>{heading}</StyledGroupHeading>
      <StyledGroup>{children}</StyledGroup>
    </>
  );
};

export const RightDrawerChatAllActionsContent = () => {
  const INSTANCE_ID = 'chat-action-menu';
  const [actionsList, setActionsList] = useState<ChatAction[]>([]);
  
  // Set the necessary context store states for actions to work
  const setCurrentObjectMetadataItem = useSetRecoilComponentStateV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    INSTANCE_ID
  );
  
  const setCurrentViewType = useSetRecoilComponentStateV2(
    contextStoreCurrentViewTypeComponentState,
    INSTANCE_ID
  );
  
  const setTargetedRecordsRule = useSetRecoilComponentStateV2(
    contextStoreTargetedRecordsRuleComponentState,
    INSTANCE_ID
  );
  
  // Add the missing state setter for the number of selected records
  const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
    contextStoreNumberOfSelectedRecordsComponentState,
    INSTANCE_ID
  );
  
  useEffect(() => {
    const objectMetadata = {
      id: 'candidate-id',
      nameSingular: 'candidate',
      namePlural: 'candidates',
      labelSingular: 'Candidate',
      labelPlural: 'Candidates',
      description: 'Candidate records',
      icon: 'IconUser',
      isCustom: false,
      isRemote: false,
      isActive: true,
      isSystem: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labelIdentifierFieldMetadataId: 'name-field-id',
      imageIdentifierFieldMetadataId: null,
      isLabelSyncedWithName: true,
      fields: [],
      indexMetadatas: []
    };
    
    setCurrentObjectMetadataItem(objectMetadata);
    
    setCurrentViewType(ContextStoreViewType.Table);
    
    // Use the shared state from chatActionsState
    const selectedIds = chatActionsState.selectedRecordIds || [];
    
    setTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: selectedIds
    });
    
    // Set the number of selected records based on the length of selectedIds
    setNumberOfSelectedRecords(selectedIds.length);
    
    prepareActions();
  }, [setCurrentObjectMetadataItem, setCurrentViewType, setTargetedRecordsRule, setNumberOfSelectedRecords]);
  
  const prepareActions = () => {
    const allActions = Object.values(CHAT_ACTIONS_CONFIG) as unknown as ChatAction[];
    
    const filteredActions = allActions.filter(
      action => action.availableOn?.includes(ActionViewType.INDEX_PAGE_BULK_SELECTION)
    );
    
    setActionsList(filteredActions);
  };
  
  const pinnedActions = actionsList.filter(action => action.isPinned);
  const nonPinnedActions = actionsList.filter(action => !action.isPinned);

  return (
    <ActionMenuContext.Provider
      value={{
        isInRightDrawer: true,
        onActionStartedCallback: () => {},
        onActionExecutedCallback: () => {},
      }}
    >
      <ContextStoreComponentInstanceContext.Provider
        value={{
          instanceId: INSTANCE_ID,
        }}
      >
        <ActionMenuComponentInstanceContext.Provider
          value={{
            instanceId: INSTANCE_ID,
          }}
        >
          <StyledContainer>
            {pinnedActions.length > 0 && (
              <ActionGroup heading="Pinned Actions">
                {pinnedActions.map((action) => (
                  <ActionItem key={action.key} action={action} />
                ))}
              </ActionGroup>
            )}

            {nonPinnedActions.length > 0 && (
              <ActionGroup heading="Other Actions">
                {nonPinnedActions.map((action) => (
                  <ActionItem key={action.key} action={action} />
                ))}
              </ActionGroup>
            )}
          </StyledContainer>
        </ActionMenuComponentInstanceContext.Provider>
      </ContextStoreComponentInstanceContext.Provider>
    </ActionMenuContext.Provider>
  );
}; 