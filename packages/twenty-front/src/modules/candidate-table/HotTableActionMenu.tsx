import { ActionMenuConfirmationModals } from "@/action-menu/components/ActionMenuConfirmationModals";
import { RecordIndexActionMenuBarEntry } from "@/action-menu/components/RecordIndexActionMenuBarEntry";
import { RecordIndexActionMenuDropdown } from "@/action-menu/components/RecordIndexActionMenuDropdown";
import { RecordIndexActionMenuEffect } from "@/action-menu/components/RecordIndexActionMenuEffect";
import { ActionMenuContext } from "@/action-menu/contexts/ActionMenuContext";
import { actionMenuEntriesComponentSelector } from "@/action-menu/states/actionMenuEntriesComponentSelector";
import { ActionMenuComponentInstanceContext } from "@/action-menu/states/contexts/ActionMenuComponentInstanceContext";
import { ActionBarHotkeyScope } from "@/action-menu/types/ActionBarHotKeyScope";
import { ActionMenuEntry } from "@/action-menu/types/ActionMenuEntry";
import { getActionBarIdFromActionMenuId } from "@/action-menu/utils/getActionBarIdFromActionMenuId";
import { ChatActionMenuEntriesSetter } from "@/activities/chats/components/ChatActionMenuEntriesSetter";
import { chatActionsState } from "@/activities/chats/components/RightDrawerChatAllActionsContent";
import { contextStoreNumberOfSelectedRecordsComponentState } from "@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState";
import { contextStoreTargetedRecordsRuleComponentState } from "@/context-store/states/contextStoreTargetedRecordsRuleComponentState";
import { BottomBar } from "@/ui/layout/bottom-bar/components/BottomBar";
import { useRightDrawer } from "@/ui/layout/right-drawer/hooks/useRightDrawer";
import { RightDrawerPages } from "@/ui/layout/right-drawer/types/RightDrawerPages";
import { useRecoilComponentValueV2 } from "@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2";
import { useTheme } from "@emotion/react";
import styled from "@emotion/styled";
import { IconLayoutSidebarRightExpand } from "twenty-ui";


// Custom action menu All Actions button for chat
const HotTableAllActionsButton = () => {
    const theme = useTheme();
    const { openRightDrawer } = useRightDrawer();
    
    const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
      contextStoreTargetedRecordsRuleComponentState,
    );
  
    const handleClick = () => {
      // Store the selected IDs in the shared state
      if (contextStoreTargetedRecordsRule?.mode === 'selection') {
        chatActionsState.selectedRecordIds = contextStoreTargetedRecordsRule.selectedRecordIds;
      } else {
        chatActionsState.selectedRecordIds = [];
      }
      
      // Open the right drawer
      openRightDrawer(RightDrawerPages.ChatAllActions, {
        title: 'Chat Actions',
        Icon: IconLayoutSidebarRightExpand,
      });
    };
  
    const StyledButton = styled.div`
      border-radius: ${({ theme }) => theme.border.radius.sm};
      color: ${({ theme }) => theme.font.color.secondary};
      cursor: pointer;
      display: flex;
      justify-content: center;
      padding: ${({ theme }) => theme.spacing(2)};
      transition: background ${({ theme }) => theme.animation.duration.fast} ease;
      user-select: none;
      &:hover {
        background: ${({ theme }) => theme.background.tertiary};
      }
    `;
  
    const StyledButtonLabel = styled.div`
      font-weight: ${({ theme }) => theme.font.weight.medium};
      margin-left: ${({ theme }) => theme.spacing(1)};
    `;
  
    const StyledSeparator = styled.div`
      background: ${({ theme }) => theme.border.color.light};
      height: ${({ theme }) => theme.spacing(8)};
      margin: 0 ${({ theme }) => theme.spacing(1)};
      width: 1px;
    `;
  
    return (
      <>
        <StyledSeparator />
        <StyledButton onClick={handleClick}>
          <IconLayoutSidebarRightExpand size={theme.icon.size.md} />
          <StyledButtonLabel>All Actions</StyledButtonLabel>
        </StyledButton>
      </>
    );
  };

// Custom record index action menu bar for chat that includes the All Actions button
const ChatRecordIndexActionMenuBar = ({ tableId }: { tableId: string }) => {
  
    const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
      contextStoreNumberOfSelectedRecordsComponentState,
      tableId
    );
  
    const actionMenuEntries = useRecoilComponentValueV2(
      actionMenuEntriesComponentSelector,
      tableId
    ) as ActionMenuEntry[];
  
  
    const pinnedEntries = actionMenuEntries.filter((entry) => entry.isPinned);
    
    
    if (contextStoreNumberOfSelectedRecords === 0) {
      return null;
    }
  
    // Use tableId as the action menu ID
    const actionMenuId = tableId;
  
    const StyledLabel = styled.div`
      color: ${({ theme }) => theme.font.color.tertiary};
      font-size: ${({ theme }) => theme.font.size.md};
      font-weight: ${({ theme }) => theme.font.weight.medium};
      padding-left: ${({ theme }) => theme.spacing(2)};
      padding-right: ${({ theme }) => theme.spacing(2)};
    `;
  
    const StyledSeparator = styled.div`
      background: ${({ theme }) => theme.border.color.light};
      height: ${({ theme }) => theme.spacing(8)};
      margin: 0 ${({ theme }) => theme.spacing(1)};
      width: 1px;
    `;
  
    return (
      <BottomBar
        bottomBarId={getActionBarIdFromActionMenuId(actionMenuId)}
        bottomBarHotkeyScopeFromParent={{ scope: ActionBarHotkeyScope.ActionBar }}
      >
        <StyledLabel>{contextStoreNumberOfSelectedRecords} selected:</StyledLabel>
        {pinnedEntries.map((entry: ActionMenuEntry, index: number) => (
          <RecordIndexActionMenuBarEntry key={index} entry={entry} />
        ))}
        <HotTableAllActionsButton />
      </BottomBar>
    );
  };
  
// Custom chat action menu without the standard record actions
export const HotTableActionMenu = ({ tableId }: { tableId: string }) => {
  
    return (
      <ActionMenuContext.Provider
        value={{
          isInRightDrawer: false,
          onActionStartedCallback: () => {},
          onActionExecutedCallback: () => {},
        }}
      >
        <ChatRecordIndexActionMenuBar tableId={tableId} />
        <ActionMenuComponentInstanceContext.Provider
          value={{
            instanceId: tableId,
          }}
        >
          <RecordIndexActionMenuDropdown />
          <ActionMenuConfirmationModals />
          <RecordIndexActionMenuEffect />
        </ActionMenuComponentInstanceContext.Provider>
        <ChatActionMenuEntriesSetter />
      </ActionMenuContext.Provider>
    );
  };
  