import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.css';
import 'handsontable/styles/ht-theme-main.min.css';

import { useTheme } from '@emotion/react';
import React, { useEffect, useMemo, useRef } from 'react';
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
  } = useChatTable(individuals, onSelectionChange);

  const theme = useTheme();
  const hotRef = useRef<any>(null);

  useEffect(() => {
    if (!hotRef.current?.hotInstance) {
      return;
    }

    // const themeName = theme.name === 'dark' ? 'ht-theme-horizon-dark' : 'ht-theme-horizon';
    const themeName = theme.name === 'dark' ? 'ht-theme-main-dark' : 'ht-theme-main';
    hotRef.current.hotInstance.useTheme(themeName);
    hotRef.current.hotInstance.render();
  }, [theme.name]);

  const columns = useMemo(
    () => createTableColumns(individuals, handleCheckboxChange),
    [individuals, handleCheckboxChange]
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
        autoWrapRow={true}
        autoWrapCol={true}
        manualRowResize={true}
        manualColumnResize={true}
        contextMenu={true}
        filters={true}
        dropdownMenu={true}
        hiddenColumns={{
          columns: [0],
          indicators: true,
        }}
        afterSelection={(row: number) => {
          if (row >= 0) {
            const selectedIndividual = individuals[row];
            onIndividualSelect(selectedIndividual.id);
          }
        }}
      />
    ),
    [individuals, columns, prepareTableData, onIndividualSelect]
  );

  return (
    <>
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
      />

      <MultiCandidateChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        selectedPeople={selectedPeople} 
      />

      {isAttachmentPanelOpen && currentCandidate && (
        <>
          <AttachmentPanel
            isOpen={isAttachmentPanelOpen}
            onClose={() => setIsAttachmentPanelOpen(false)}
            candidateId={currentCandidate.candidates.edges[0].node.id}
            candidateName={`${currentCandidate.name.firstName} ${currentCandidate.name.lastName}`}
            PanelContainer={PanelContainer}
          />

          {selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen) && (
            <CandidateNavigation>
              <NavIconButton 
                onClick={handlePrevCandidate} 
                disabled={currentPersonIndex === 0} 
                title="Previous Candidate"
              >
                ←
              </NavIconButton>

              <NavIconButton 
                onClick={handleNextCandidate} 
                disabled={currentPersonIndex === selectedIds.length - 1} 
                title="Next Candidate"
              >
                →
              </NavIconButton>
            </CandidateNavigation>
          )}
        </>
      )}
    </>
  );
};

export default ChatTable; 