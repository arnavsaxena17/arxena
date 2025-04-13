import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.css';
import 'handsontable/styles/ht-theme-main.min.css';

import { RecordIndexActionMenu } from '@/action-menu/components/RecordIndexActionMenu';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useTheme } from '@emotion/react';
import React, { useEffect, useMemo, useRef } from 'react';
import { IconList } from 'twenty-ui';
import ActionsBar from '../ActionsBar';
import AttachmentPanel from '../AttachmentPanel';
import MultiCandidateChat from '../MultiCandidateChat';
import { CandidateNavigation, NavIconButton, PanelContainer, TableContainer } from './styled';
import { createTableColumns } from './TableColumns';
import { ChatTableProps } from './types';
import { useChatTable } from './useChatTable';




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
    tableId,
  } = useChatTable(individuals, onSelectionChange, onIndividualSelect);

  const theme = useTheme();
  const hotRef = useRef<any>(null);

  // Set the current object metadata item for action menu 
  const setCurrentObjectMetadataItem = useSetRecoilComponentStateV2(
    contextStoreCurrentObjectMetadataItemComponentState,
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
  }, [setCurrentObjectMetadataItem]);

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
  
  const hotTableComponent = useMemo(
    () => (
      <HotTable
        ref={hotRef}
        data={prepareTableData(individuals)}
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
        afterGetColHeader={(col, TH) => {
          if (col === 0) {
            const isAllSelected = selectedIds.length === individuals.length && individuals.length > 0;
            const headerCell = TH.querySelector('.colHeader');
            if (headerCell) {
              headerCell.innerHTML = `<input type="checkbox" class="select-all-checkbox" ${isAllSelected ? 'checked' : ''}>`;
              const checkbox = headerCell.querySelector('.select-all-checkbox');
              if (checkbox) {
                checkbox.addEventListener('click', (e) => {
                  e.stopPropagation();
                  handleSelectAll();
                });
              }
            }
          }
        }}
        afterSelection={(row: number) => {
          if (row >= 0) {
            const selectedIndividual = individuals[row];
            onIndividualSelect(selectedIndividual.id);
            if (!selectedIds.includes(selectedIndividual.id)) {
              handleCheckboxChange(selectedIndividual.id);
            }
          }
        }}
        beforeOnCellMouseDown={(event, coords) => {
          const target = event.target as HTMLElement;
          if (target.nodeName === 'INPUT' && (target.className === 'select-all-checkbox' || target.className === 'row-checkbox')) {
            event.stopImmediatePropagation();
          }
        }}
      />
    ),
    [individuals, columns, prepareTableData, onIndividualSelect, selectedIds, handleCheckboxChange, handleSelectAll]
  );

  console.log('handleActivityDrawer');
  const { openRightDrawer } = useRightDrawer();

  const handleActivityDrawerClick = () => {
    openRightDrawer(RightDrawerPages.SimpleActivity, {
      title: 'Simple Activity',
      Icon: IconList,
    });
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
          {hotTableComponent}
        </TableContainer>
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
        <RecordIndexActionMenu indexId={tableId} />
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
