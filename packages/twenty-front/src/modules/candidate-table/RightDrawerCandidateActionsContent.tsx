import { TABLE_CANDIDATE_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/TableCandidateActionsConfig';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import { ActionMenuContext } from '@/action-menu/contexts/ActionMenuContext';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import styled from '@emotion/styled';
import { i18n, MessageDescriptor } from '@lingui/core';
import React, { useCallback, useEffect, useState } from 'react';
import { IconComponent, MenuItemCommand } from 'twenty-ui';

// Define action types
type ActionHook = (params: { objectMetadataItem: any }) => {    
  onClick: () => void | Promise<void>;
  shouldBeRegistered?: boolean;
  ConfirmationModal?: React.ReactNode;
  isLoading?: boolean;
};

// Update the CandidateAction type to match the actual structure
type TableCandidateAction = {
  key: string;
  label: MessageDescriptor | string;
  Icon: IconComponent;
  isPinned?: boolean;
  useAction?: ActionHook;
  availableOn?: ActionViewType[];
};

// Create a singleton to share the selected IDs between components
export const candidateActionsState = {
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
const ActionItem = ({ action }: { action: TableCandidateAction }) => {
  const [isLocalLoading, setIsLocalLoading] = useState(false);

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

  const handleClick = async () => {
    if (actionResult?.onClick) {
      setIsLocalLoading(true);
      try {
        await actionResult.onClick();
      } catch (error) {
        console.error('Action failed:', error);
      } finally {
        setIsLocalLoading(false);
      }
    } else {
      console.log(`Action ${action.key} clicked but no onClick handler found`);
    }
  };

  const isDisabled = isLocalLoading || (actionResult?.isLoading ?? false);

  return (
    <>
      <MenuItemCommand
        LeftIcon={action.Icon}
        text={translate(action.label)}
        onClick={handleClick}
        className={isDisabled ? 'disabled' : ''}
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

export const RightDrawerCandidateActionsContent = () => {
  const INSTANCE_ID = 'candidate-action-menu';
  const [actionsList, setActionsList] = useState<TableCandidateAction[]>([]);
  
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
  
  const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
    contextStoreNumberOfSelectedRecordsComponentState,
    INSTANCE_ID
  );

  const resetSelectionState = useCallback(() => {
    setTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: []
    });
    setNumberOfSelectedRecords(0);
    candidateActionsState.selectedRecordIds = [];
  }, [setTargetedRecordsRule, setNumberOfSelectedRecords]);
  
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
    const selectedIds = candidateActionsState.selectedRecordIds || [];
    
    setTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: selectedIds
    });
    
    setNumberOfSelectedRecords(selectedIds.length);
    
    prepareActions();

    // Cleanup function
    return () => {
      resetSelectionState();
    };
  }, [
    setCurrentObjectMetadataItem, 
    setCurrentViewType, 
    setTargetedRecordsRule, 
    setNumberOfSelectedRecords,
    resetSelectionState
  ]);
  
  const prepareActions = () => {
    const allActions = Object.values(TABLE_CANDIDATE_ACTIONS_CONFIG) as unknown as TableCandidateAction[];
    
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
        onActionExecutedCallback: () => {
          resetSelectionState();
        },
      }}
    >
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: INSTANCE_ID, }}
      >
        <ActionMenuComponentInstanceContext.Provider
          value={{ instanceId: INSTANCE_ID }}
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
