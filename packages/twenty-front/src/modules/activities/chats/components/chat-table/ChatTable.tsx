import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.css';
import 'handsontable/styles/ht-theme-main.min.css';

import { ActionMenuConfirmationModals } from '@/action-menu/components/ActionMenuConfirmationModals';
import { RecordIndexActionMenuBarEntry } from '@/action-menu/components/RecordIndexActionMenuBarEntry';
import { RecordIndexActionMenuDropdown } from '@/action-menu/components/RecordIndexActionMenuDropdown';
import { RecordIndexActionMenuEffect } from '@/action-menu/components/RecordIndexActionMenuEffect';
import { ActionMenuContext } from '@/action-menu/contexts/ActionMenuContext';
import { actionMenuEntriesComponentSelector } from '@/action-menu/states/actionMenuEntriesComponentSelector';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { ActionBarHotkeyScope } from '@/action-menu/types/ActionBarHotKeyScope';
import { ActionMenuEntry } from '@/action-menu/types/ActionMenuEntry';
import { getActionBarIdFromActionMenuId } from '@/action-menu/utils/getActionBarIdFromActionMenuId';
import { ChatActionMenuEntriesSetter } from '@/activities/chats/components/ChatActionMenuEntriesSetter';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { BottomBar } from '@/ui/layout/bottom-bar/components/BottomBar';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useEffect, useMemo, useRef } from 'react';
import { IconLayoutSidebarRightExpand, IconList } from 'twenty-ui';
import AttachmentPanel from '../AttachmentPanel';
import MultiCandidateChat from '../MultiCandidateChat';
import { CandidateNavigation, NavIconButton, PanelContainer, TableContainer } from './styled';
import { createTableColumns } from './TableColumns';
import { ChatTableProps } from './types';
import { useChatTable } from './useChatTable';

// Custom action menu All Actions button for chat
const ChatAllActionsButton = () => {
  const theme = useTheme();
  const { openRightDrawer } = useRightDrawer();

  const handleClick = () => {
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
const ChatRecordIndexActionMenuBar = () => {
  const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
    contextStoreNumberOfSelectedRecordsComponentState,
  );

  const actionMenuId = useAvailableComponentInstanceIdOrThrow(
    ActionMenuComponentInstanceContext,
  );

  const actionMenuEntries = useRecoilComponentValueV2(
    actionMenuEntriesComponentSelector,
  ) as ActionMenuEntry[];

  const pinnedEntries = actionMenuEntries.filter((entry) => entry.isPinned);
  
  if (contextStoreNumberOfSelectedRecords === 0) {
    return null;
  }

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
      <ChatAllActionsButton />
    </BottomBar>
  );
};

// Custom chat action menu without the standard record actions
const ChatActionMenu = ({ tableId }: { tableId: string }) => {
  return (
    <ActionMenuContext.Provider
      value={{
        isInRightDrawer: false,
        onActionStartedCallback: () => {},
        onActionExecutedCallback: () => {},
      }}
    >
      <ChatRecordIndexActionMenuBar />
      <RecordIndexActionMenuDropdown />
      <ActionMenuConfirmationModals />
      <RecordIndexActionMenuEffect />
      <ChatActionMenuEntriesSetter />
    </ActionMenuContext.Provider>
  );
};

registerAllModules();

export const ChatTable: React.FC<ChatTableProps> = ({
  individuals,
  selectedIndividual,
  unreadMessages,
  onIndividualSelect,
  onSelectionChange,
  onBulkMessage,
  onBulkDelete,
  onBulkAssign,
  onReorder,
}) => {
  const {
    selectedIds,
    isAttachmentPanelOpen,
    currentPersonIndex,
    isChatOpen,
    currentCandidate,
    selectedPeople,
    handleCheckboxChange,
    handleViewChats,
    handleViewCVs,
    clearSelection,
    handlePrevCandidate,
    handleNextCandidate,
    prepareTableData,
    createCandidateShortlists,
    createChatBasedShortlistDelivery,
    createUpdateCandidateStatus,
    setIsAttachmentPanelOpen,
    setIsChatOpen,
    handleSelectAll,
    handleAfterChange,
    tableId,
    tableData,
  } = useChatTable(individuals, onSelectionChange, onIndividualSelect);

  const theme = useTheme();
  const hotRef = useRef<any>(null);

  // Set the current object metadata item for action menu 
  const setCurrentObjectMetadataItem = useSetRecoilComponentStateV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    tableId
  );
  
  // Set the current view type for action menu
  const setCurrentViewType = useSetRecoilComponentStateV2(
    contextStoreCurrentViewTypeComponentState,
    tableId
  );

  // Set object metadata item for the action menu
  useEffect(() => {
    // Cast as any to bypass TypeScript checking since we're providing minimal data
    // that satisfies what the RecordIndexActionMenu needs
    setCurrentObjectMetadataItem({
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
    } as any);
    
    // Set the view type to Table
    setCurrentViewType(ContextStoreViewType.Table);
  }, [setCurrentObjectMetadataItem, setCurrentViewType]);

  useEffect(() => {
    if (!hotRef.current?.hotInstance) {
      return;
    }

    const themeName = theme.name === 'dark' ? 'ht-theme-main-dark' : 'ht-theme-main';
    hotRef.current.hotInstance.useTheme(themeName);
    hotRef.current.hotInstance.render();
  }, [theme.name]);

  const columns = useMemo(
    () => createTableColumns(individuals, handleCheckboxChange, selectedIds, handleSelectAll),
    [individuals, handleCheckboxChange, selectedIds, handleSelectAll]
  );
  
  // For the activity drawer
  const { openRightDrawer } = useRightDrawer();
  const handleActivityDrawerClick = () => {
    openRightDrawer(RightDrawerPages.SimpleActivity, {
      title: 'Simple Activity',
      Icon: IconList,
    });
  };

  const handleCellProperties = (row: number, col: number) => {
    const cellProperties = {};
    // Make sure the first column (checkbox) is read-only
    if (col === 0) {
      return { ...cellProperties, readOnly: true };
    }
    return cellProperties;
  }

  const handleAfterChangeCells = (changes: any, source: any) => {
    if (source !== 'loadData') {
      handleAfterChange(changes, source);
    }
  }

  const handleAfterGetColHeader = (col: number, TH: any) => {
    if (col === 0) {
      const isAllSelected = selectedIds.length === individuals.length && individuals.length > 0;
      const headerCell = TH.querySelector('.colHeader');
      if (headerCell) {
        headerCell.innerHTML = `<input type="checkbox" class="select-all-checkbox" ${isAllSelected ? 'checked' : ''}>`;
        const checkbox = headerCell.querySelector('.select-all-checkbox');
        if (checkbox) {
          checkbox.addEventListener('click', (e: { stopPropagation: () => void; }) => {
            e.stopPropagation();
            handleSelectAll();
          });
        }
      }
    }
  }
  

  const handleAfterSelection =  (row: number) => {
    if (row >= 0) {
      const selectedIndividual = individuals[row];
      onIndividualSelect(selectedIndividual.id);
      if (!selectedIds.includes(selectedIndividual.id)) {
        handleCheckboxChange(selectedIndividual.id);
      }
    }
  }

  const handleBeforeOnCellMouseDown = (event: any, coords: any) => {
    const target = event.target as HTMLElement;
    if (target.nodeName === 'INPUT' && (target.className === 'select-all-checkbox' || target.className === 'row-checkbox')) {
      event.stopImmediatePropagation();
    }
  }


  // 
  // 
  // Create a deep mutable copy of the tableData to prevent "read-only property" errors
  const mutableData = tableData.map(row => ({...row}));
  
  return (
    <ContextStoreComponentInstanceContext.Provider
      value={{
        instanceId: tableId,
      }}
    >
      <ActionMenuComponentInstanceContext.Provider
        value={{
          instanceId: tableId,
        }}
      >
        <TableContainer>
          <HotTable
            ref={hotRef}
            data={mutableData}
            columns={columns}
            colHeaders={true}
            rowHeaders={true}
            height="auto"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            className="htCenter"
            readOnly={false}
            autoWrapRow={false}
            autoWrapCol={false}
            autoRowSize={false}
            rowHeights={30}
            manualRowResize={true}
            manualColumnResize={true}
            contextMenu={true}
            filters={true}
            dropdownMenu={true}
            cells={handleCellProperties}
            // Important: Use a specific source to avoid infinite loops
            afterChange={handleAfterChangeCells}
            afterGetColHeader={handleAfterGetColHeader}
            afterSelection={handleAfterSelection}
            beforeOnCellMouseDown={handleBeforeOnCellMouseDown}
          />
        </TableContainer>
        <ChatActionMenu tableId={tableId} />
        <MultiCandidateChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedPeople={selectedPeople} />
        {isAttachmentPanelOpen && currentCandidate && (
          <>
            <AttachmentPanel isOpen={isAttachmentPanelOpen} onClose={() => setIsAttachmentPanelOpen(false)} candidateId={currentCandidate.candidates.edges[0].node.id} candidateName={`${currentCandidate.name.firstName} ${currentCandidate.name.lastName}`} PanelContainer={PanelContainer} />
            {selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen) && (
              <CandidateNavigation>
                <NavIconButton onClick={handlePrevCandidate} disabled={currentPersonIndex === 0} title="Previous Candidate" > ← </NavIconButton>
                <NavIconButton onClick={handleNextCandidate} disabled={currentPersonIndex === selectedIds.length - 1} title="Next Candidate" > → </NavIconButton>
              </CandidateNavigation>
            )}
          </>
        )}
      </ActionMenuComponentInstanceContext.Provider>
    </ContextStoreComponentInstanceContext.Provider>
  );
};

export default ChatTable; 

function uuid() {
  throw new Error('Function not implemented.');
}
