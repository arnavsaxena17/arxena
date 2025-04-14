import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import { ActionMenuContext } from '@/action-menu/contexts/ActionMenuContext';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { CHAT_ACTIONS_CONFIG } from '@/activities/chats/constants/ChatActionsConfig';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import styled from '@emotion/styled';
import { i18n } from '@lingui/core';
import { useEffect, useState } from 'react';
import { MenuItemCommand } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledSectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.light};
  margin-top: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

export const RightDrawerChatAllActionsContent = () => {
  const INSTANCE_ID = 'chat-action-menu';
  const [preparedActions, setPreparedActions] = useState<any[]>([]);
  
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
  
  // Initialize the context store with needed values
  useEffect(() => {
    // Set a minimal person object metadata
    const objectMetadata = {
      id: 'person-id',
      nameSingular: 'person',
      namePlural: 'people',
      labelSingular: 'Person',
      labelPlural: 'People',
      description: 'Person records',
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
    
    // Set the view type to make sure actions can be filtered correctly
    setCurrentViewType(ContextStoreViewType.Table);
    
    // Set the targeted records rule to simulate bulk selection
    setTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: ['1', '2', '3'] // Simulate 3 selected records
    });
    
    // Process the chat actions after context is set
    prepareActions();
  }, []);
  
  const prepareActions = () => {
    // Get all actions from CHAT_ACTIONS_CONFIG
    const allActions = Object.values(CHAT_ACTIONS_CONFIG);
    
    // Prepare actions with required properties
    const actionsList = allActions.map(action => {
      try {
        // Create a simple actionHook with essential properties
        const actionHook = {
          shouldBeRegistered: true,
          onClick: () => {
            console.log(`Action ${action.key} clicked`);
            // Here we would normally call the actual action function
            try {
              if (action.useAction) {
                const hookResult = action.useAction({
                  objectMetadataItem: {
                    id: 'person-id',
                    nameSingular: 'person',
                    namePlural: 'people',
                    labelSingular: 'Person',
                    labelPlural: 'People',
                    description: 'Person records',
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
                });
                
                if (hookResult && hookResult.onClick) {
                  hookResult.onClick();
                }
              }
            } catch (error) {
              console.error(`Error executing action ${action.key}:`, error);
            }
          }
        };
        
        return {
          ...action,
          actionHook,
        };
      } catch (error) {
        console.warn(`Error initializing action ${action.key}:`, error);
        return {
          ...action,
          actionHook: { shouldBeRegistered: false, onClick: () => {} },
        };
      }
    });
    
    // Only include actions available for bulk selection view
    const filteredActions = actionsList.filter(
      action => action.availableOn?.includes(ActionViewType.INDEX_PAGE_BULK_SELECTION)
    );
    
    setPreparedActions(filteredActions);
  };
  
  // Split into pinned and non-pinned actions
  const pinnedActions = preparedActions.filter(action => action.isPinned);
  const nonPinnedActions = preparedActions.filter(action => !action.isPinned);

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
            <StyledTitle>Chat Actions</StyledTitle>
            
            {pinnedActions.length > 0 && (
              <>
                <StyledSectionTitle>Pinned Actions</StyledSectionTitle>
                <StyledItemsContainer>
                  {pinnedActions.map((action) => (
                    <MenuItemCommand
                      key={action.key}
                      LeftIcon={action.Icon}
                      text={i18n._(action.label)}
                      onClick={action.actionHook?.onClick}
                    />
                  ))}
                </StyledItemsContainer>
              </>
            )}

            {nonPinnedActions.length > 0 && (
              <>
                <StyledSectionTitle>Other Actions</StyledSectionTitle>
                <StyledItemsContainer>
                  {nonPinnedActions.map((action) => (
                    <MenuItemCommand
                      key={action.key}
                      LeftIcon={action.Icon}
                      text={i18n._(action.label)}
                      onClick={action.actionHook?.onClick}
                    />
                  ))}
                </StyledItemsContainer>
              </>
            )}
          </StyledContainer>
        </ActionMenuComponentInstanceContext.Provider>
      </ContextStoreComponentInstanceContext.Provider>
    </ActionMenuContext.Provider>
  );
}; 