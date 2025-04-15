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
import ActionsBar from '@/activities/chats/components/ActionsBar';
import { ChatActionMenuEntriesSetter } from '@/activities/chats/components/ChatActionMenuEntriesSetter';
import { chatActionsState } from '@/activities/chats/components/RightDrawerChatAllActionsContent';
import { selectedCandidateIdState } from '@/activities/chats/states/selectedCandidateIdState';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { BottomBar } from '@/ui/layout/bottom-bar/components/BottomBar';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { IconLayoutSidebarRightExpand, IconList, IconMessages } from '@tabler/icons-react';
import React, { useEffect, useMemo, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
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

registerAllModules();

export const ChatTable: React.FC<ChatTableProps> = ({
  candidates,
  selectedCandidate,
  unreadMessages,
  onCandidateSelect,
  // onSelectionChange,
  onBulkMessage,
  onBulkDelete,
  onBulkAssign,
  onReorder,
}) => {
  const {
    selectedIds,
    isAttachmentPanelOpen,
    currentCandidateIndex,
    isChatOpen,
    currentCandidate,
    selectedCandidates,
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
    handleRowSelection,
  } = useChatTable(candidates, onCandidateSelect);

  const theme = useTheme();
  const hotRef = useRef<any>(null);
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);

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

  // Get setters for context store states
  const setContextStoreNumberOfSelectedRecords = useSetRecoilComponentStateV2(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableId
  );
  
  const setContextStoreTargetedRecordsRule = useSetRecoilComponentStateV2(
    contextStoreTargetedRecordsRuleComponentState,
    tableId
  );

  // Set object metadata item for the action menu
  useEffect(() => {
    // Cast as any to bypass TypeScript checking since we're providing minimal data
    // that satisfies what the RecordIndexActionMenu needs
    setCurrentObjectMetadataItem({
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
    } as any);
    
    // Set the view type to Table
    setCurrentViewType(ContextStoreViewType.Table);
  }, [setCurrentObjectMetadataItem, setCurrentViewType]);

  // Add this effect to update the context store when selectedIds changes
  useEffect(() => {
    setContextStoreNumberOfSelectedRecords(selectedIds.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: selectedIds,
    });
    
  }, [selectedIds, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule]);

  // Initialize with the selected individual if provided
  useEffect(() => {
    if (selectedCandidate && candidates.length > 0) {
      const candidate = candidates.find(cand => cand.id === selectedCandidate);
      if (candidate) {
        // Make sure this candidate is in the selectedIds
        if (!selectedIds.includes(candidate.id)) {
          handleCheckboxChange(candidate.id);
        }
      }
    }
  }, [selectedCandidate, candidates, selectedIds, handleCheckboxChange]);

  useEffect(() => {
    if (!hotRef.current?.hotInstance) {
      return;
    }

    const themeName = theme.name === 'dark' ? 'ht-theme-main-dark' : 'ht-theme-main';
    hotRef.current.hotInstance.useTheme(themeName);
    hotRef.current.hotInstance.render();
  }, [theme.name]);

  const columns = useMemo(
    () => createTableColumns(candidates, handleCheckboxChange, selectedIds, handleSelectAll),
    [candidates, handleCheckboxChange, selectedIds, handleSelectAll]
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
      const isAllSelected = selectedIds.length === candidates.length && candidates.length > 0;
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
  
  // Direct implementation of row selection handling to bypass the import
  const lastRowSelected = useRef<{rowIndex: number, timestamp: number, handled: boolean}>({rowIndex: -1, timestamp: 0, handled: false});
  const directHandleRowSelection = (rowIndex: number) => {
    // Log information about the selected row to help debug the last row issue
    console.log('directHandleRowSelection called with:');
    console.log('- row index:', rowIndex);
    console.log('- total rows:', candidates.length);
    console.log('- is last row:', rowIndex === candidates.length - 1);
    
    // Debounce the function to prevent multiple calls within a short timeframe
    const now = Date.now();
    const isRecentSelection = lastRowSelected.current.rowIndex === rowIndex && 
                              now - lastRowSelected.current.timestamp < 300;
    
    if (isRecentSelection && lastRowSelected.current.handled) {
      console.log('Debouncing row selection, already handled recently');
      return;
    }
    
    // Update the reference even if it's the same row to mark it as handled
    lastRowSelected.current = {rowIndex, timestamp: now, handled: true};
    
    if (rowIndex >= 0 && rowIndex < candidates.length) {
      const candidate = candidates[rowIndex];
      console.log('Direct implementation - handling candidate:', candidate.name, candidate.id);
      
      // Check and select the row's checkbox if not already selected
      if (!selectedIds.includes(candidate.id)) {
        console.log('Selecting checkbox for candidate:', candidate.name);
        handleCheckboxChange(candidate.id);
      }
      
      // Set the selected candidate ID directly
      setSelectedCandidateId(candidate.id);
      console.log('Selected candidate ID set to:', candidate.id);
      
      // Open the right drawer directly
      console.log('About to open right drawer with CandidateChat page');
      try {
        openRightDrawer(RightDrawerPages.CandidateChat, {
          title: `Chat with ${candidate.name}`,
          Icon: IconMessages,
        });
        console.log('Right drawer opened successfully');
      } catch (error) {
        console.error('Error opening right drawer:', error);
      }
    }
  };

  const handleAfterSelection = (row: number, column: number, row2: number, column2: number, preventScrolling: object, selectionLayerLevel: number) => {
    console.log('handleAfterSelection event', row, column, row2, column2);
    console.log('- Selection happening on row:', row, 'of', candidates.length, 'rows');
    console.log('- Is last row:', row === candidates.length - 1);
    
    // Skip any selection events on checkbox column
    if (column === 0 || column2 === 0) {
      return;
    }
    
    // Skip selection events on the last row to prevent reselection
    // When a checkbox is clicked on the last row, Handsontable has a quirk
    // that triggers selection even after we handle the checkbox click
    if (row === candidates.length - 1) {
      console.log('Skipping selection for last row to prevent auto-reselection');
      return;
    }
    
    // For keyboard navigation (or any selection that isn't immediately handled by cell click)
    // We need to check if this selection was from a recent cell click that we've already handled
    const now = Date.now();
    if (lastRowSelected.current.rowIndex === row && 
        now - lastRowSelected.current.timestamp < 300) {
      // This selection event is likely a result of a cell click we've already processed
      console.log('Skipping afterSelection handler - already handled by cell click');
      return;
    }
    
    // If we get here, this is likely from keyboard navigation or programmatic selection
    // Only trigger on initial cell selection, not on range selection
    if (row === row2 && column === column2 && row >= 0) {
      // Don't trigger for checkbox column
      if (column > 0) {
        console.log('Handling keyboard navigation selection with row:', row);
        directHandleRowSelection(row);
      }
    }
  }

  const handleBeforeOnCellMouseDown = (event: any, coords: any) => {
    const target = event.target as HTMLElement;
    
    // Special handling for the last row to prevent reselection issues
    if (coords.row === candidates.length - 1) {
      console.log('BeforeOnCellMouseDown on last row', coords.col);
      if (coords.col === 0 || target.nodeName === 'INPUT') {
        console.log('Preventing event propagation for last row checkbox');
        event.stopImmediatePropagation();
        event.preventDefault();
        
        // For clicks directly on the checkbox in the last row, handle it here
        if (target.nodeName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
          console.log('Handling last row checkbox click directly');
          const lastCandidate = candidates[candidates.length - 1];
          if (lastCandidate) {
            setTimeout(() => {
              handleCheckboxChange(lastCandidate.id);
            }, 0);
          }
        }
        return;
      }
    }
    
    // Stop propagation for checkbox column (first column)
    if (target.nodeName === 'INPUT' || coords.col === 0) {
      event.stopImmediatePropagation();
    }
  }

  const handleCellClick = (event: MouseEvent, coords: any) => {
    // Skip clicks on checkboxes or the entire first column (checkbox column)
    const target = event.target as HTMLElement;
    
    // Special handling for the last row
    if (coords.row === candidates.length - 1) {
      console.log('Cell click on last row - col:', coords.col);
      
      // Don't process row selection for the last row when clicking on first column
      if (coords.col === 0) {
        console.log('Skipping cell click on last row first column');
        return;
      }
    }
    
    if (target.nodeName === 'INPUT' || coords.col === 0) {
      return;
    }
    
    console.log('Cell clicked at row:', coords.row, 'column:', coords.col);
    if (coords.row >= 0 && coords.col > 0) {
      // Mark this row as recently handled to prevent duplicate handling in afterSelection
      lastRowSelected.current = {rowIndex: coords.row, timestamp: Date.now(), handled: false};
      
      console.log('Calling directHandleRowSelection from handleCellClick with row:', coords.row);
      directHandleRowSelection(coords.row);
    }
  };

  // 
  // 
  // Create a deep mutable copy of the tableData to prevent "read-only property" errors
  const mutableData = tableData.map(row => ({...row}));
  
  const handleOpenCandidateChatDrawer = () => {
    // Use a test candidate ID
    const testCandidateId = candidates.length > 0 ? candidates[0].id : null;
    
    if (testCandidateId) {
      // Reset the row selection handling state
      lastRowSelected.current = {rowIndex: -1, timestamp: 0, handled: false};
      
      console.log('Test button - opening drawer for candidate ID:', testCandidateId);
      
      // Check and select the candidate's checkbox if not already selected
      if (!selectedIds.includes(testCandidateId)) {
        console.log('Selecting checkbox for test candidate');
        handleCheckboxChange(testCandidateId);
      }
      
      // Set the selected candidate ID directly
      setSelectedCandidateId(testCandidateId);
      
      // Open the drawer with CandidateChat page
      console.log('Test button - opening CandidateChat drawer');
      try {
        openRightDrawer(RightDrawerPages.CandidateChat, {
          title: 'Chat',
          Icon: IconMessages,
        });
        console.log('Right drawer opened successfully (test button)');
      } catch (error) {
        console.error('Error opening right drawer (test button):', error);
      }
    } else {
      console.error('No candidates available for testing');
    }
  };

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
          <div style={{ 
            position: 'absolute', 
            top: '10px', 
            right: '10px', 
            zIndex: 1000,
            display: 'flex',
            gap: '10px'
          }}>
            <button 
              onClick={() => {
                const testCandidateId = candidates.length > 0 ? candidates[0].id : null;
                if (testCandidateId) {
                  // Reset the row selection handling state
                  lastRowSelected.current = {rowIndex: -1, timestamp: 0, handled: false};
                  
                  // Check and select the candidate's checkbox if not already selected
                  if (!selectedIds.includes(testCandidateId)) {
                    console.log('Selecting checkbox for simple test');
                    handleCheckboxChange(testCandidateId);
                  }
                  
                  setSelectedCandidateId(testCandidateId);
                  console.log('Opening Simple Activity drawer (test)');
                  openRightDrawer(RightDrawerPages.SimpleActivity, {
                    title: 'Simple Activity',
                    Icon: IconList,
                  });
                }
              }}
              style={{
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.border.color.medium}`,
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <IconList size={16} />
              <span>Test Simple</span>
            </button>

            <button 
              onClick={handleOpenCandidateChatDrawer}
              style={{
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.border.color.medium}`,
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <IconMessages size={16} />
              <span>Test Chat</span>
            </button>
          </div>
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
            afterChange={handleAfterChangeCells}
            afterGetColHeader={handleAfterGetColHeader}
            afterSelection={handleAfterSelection}
            beforeOnCellMouseDown={handleBeforeOnCellMouseDown}
            afterOnCellMouseDown={handleCellClick}
          />
        </TableContainer>
        
        <div style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          width: '100%', 
          zIndex: 1000,
          backgroundColor: theme.background.primary
        }}>
          <ChatActionMenu tableId={tableId} />
        </div>
        <ActionsBar
          selectedIds={selectedIds}
          clearSelection={clearSelection}
          handleViewChats={handleViewChats}
          handleViewCVs={handleViewCVs}
          createChatBasedShortlistDelivery={createChatBasedShortlistDelivery}
          createUpdateCandidateStatus={createUpdateCandidateStatus}
          createCandidateShortlists={createCandidateShortlists}
          handleActivityDrawer={handleActivityDrawerClick}
        />
        <MultiCandidateChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedCandidates={selectedCandidates} />
        {isAttachmentPanelOpen && currentCandidate && (
          <>
            <AttachmentPanel isOpen={isAttachmentPanelOpen} onClose={() => setIsAttachmentPanelOpen(false)} candidateId={currentCandidate.id} candidateName={`${currentCandidate.name}`} PanelContainer={PanelContainer} />
            {selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen) && (
              <CandidateNavigation>
                <NavIconButton onClick={handlePrevCandidate} disabled={currentCandidateIndex === 0} title="Previous Candidate" > ← </NavIconButton>
                <NavIconButton onClick={handleNextCandidate} disabled={currentCandidateIndex === selectedIds.length - 1} title="Next Candidate" > → </NavIconButton>
              </CandidateNavigation>
            )}
          </>
        )}
      </ActionMenuComponentInstanceContext.Provider>
    </ContextStoreComponentInstanceContext.Provider>
  );
};

export default ChatTable; 
