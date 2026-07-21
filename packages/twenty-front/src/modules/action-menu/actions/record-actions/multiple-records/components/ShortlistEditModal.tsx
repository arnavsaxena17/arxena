import { Button, IconButton } from 'twenty-ui';
import { IconDeviceFloppy, IconDownload, IconFileText, IconMail, IconTable, IconUsers, IconX } from 'twenty-ui/icons';
import { tokenPairState } from '@/auth/states/tokenPairState';
import '@/candidate-table/initHandsontable';
import { useNotification } from '@/notification-context/NotificationContextProvider';
import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import { HotTable } from '@handsontable/react-wrapper';
import { CellChange, ChangeSource } from 'handsontable/common';
import { useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';

import { useShortlistEditModal } from '../hooks/useShortlistEditModal';

const StyledModalContent = styled.div`
  padding: 0;
  height: 500px;
  display: flex;
  flex-direction: column;
`;

const StyledTableContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  
  .handsontable {
    overflow: visible;
  }
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
  flex-wrap: wrap;
  min-height: 80px;
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const StyledModalFooter = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  overflow: visible;
  padding: ${({ theme }) => theme.spacing(4)};
  background: ${({ theme }) => theme.background.secondary};
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
`;

const StyledPrimaryActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
  flex-wrap: wrap;
  
  button {
    transition: all 0.2s ease-in-out;
    
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: ${({ theme }) => theme.boxShadow.light};
    }
    
    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }
`;

const StyledSecondaryActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
  flex-wrap: wrap;
  margin-left: auto;
  
  button {
    transition: all 0.2s ease-in-out;
    
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: ${({ theme }) => theme.boxShadow.light};
    }
    
    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }
`;

const StyledStatusText = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border-left: 3px solid ${({ theme }) => theme.color.blue};
`;

const StyledHeaderContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

interface ShortlistEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateIds: string[];
  jobId: string;
}

export const ShortlistEditModal = ({ 
  isOpen, 
  onClose, 
  candidateIds, 
  jobId 
}: ShortlistEditModalProps) => {
  const tableRef = useRef<any>(null);
  const tokenPair = useRecoilValue(tokenPairState);
  const { showNotification } = useNotification();
  
  const {
    shortlistData,
    isLoading,
    error,
    columns,
    updateShortlistData,
    saveShortlistData,
    downloadResumes,
    downloadShortlistDocument,
    downloadShortlistDocumentQuick,
    downloadExcelFile,
    createShortlistCandidates,
    createGmailDraft,
    isSaving,
    isDownloading,
    isDownloadingQuick,
    isCreatingShortlist,
    isCreatingDraft
  } = useShortlistEditModal(candidateIds, jobId, tokenPair?.accessToken?.token, isOpen);

  const afterChangeHandler = useCallback((changes: CellChange[] | null, source: ChangeSource) => {
    console.log('ShortlistEditModal afterChange called', { changes, source });
    if (source === 'edit' && changes) {
      console.log('Processing cell changes:', changes);
      updateShortlistData(changes);
    }
  }, [updateShortlistData]);

  const afterSelectionEndHandler = useCallback((row: number, column: number, row2: number, column2: number) => {
    // Prevent any global selection handlers from interfering with the modal
    // This is a no-op handler to override any global afterSelectionEnd behavior
    console.log('ShortlistEditModal afterSelectionEnd called', { row, column, row2, column2 });
    
    // Don't prevent default behavior - let the table handle selection normally
    // return false;
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await saveShortlistData();
      showNotification({
        title: 'Success',
        body: 'Shortlist data saved successfully',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to save shortlist data',
        icon: '/favicon.ico'
      });
    }
  }, [saveShortlistData, showNotification]);

  const handleDownloadResumes = useCallback(async () => {
    try {
      await downloadResumes();
      showNotification({
        title: 'Success',
        body: 'Resumes download started',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to download resumes',
        icon: '/favicon.ico'
      });
    }
  }, [downloadResumes, showNotification]);

  const handleDownloadDocument = useCallback(async () => {
    try {
      await downloadShortlistDocument();
      showNotification({
        title: 'Success',
        body: 'Shortlist document download started',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to download shortlist document',
        icon: '/favicon.ico'
      });
    }
  }, [downloadShortlistDocument, showNotification]);

  const handleDownloadDocumentQuick = useCallback(async () => {
    try {
      await downloadShortlistDocumentQuick();
      showNotification({
        title: 'Success',
        body: 'Shortlist document download started (from existing data)',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to download shortlist document',
        icon: '/favicon.ico'
      });
    }
  }, [downloadShortlistDocumentQuick, showNotification]);

  const handleDownloadExcel = useCallback(async () => {
    try {
      await downloadExcelFile();
      showNotification({
        title: 'Success',
        body: 'Excel file download started',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to download Excel file',
        icon: '/favicon.ico'
      });
    }
  }, [downloadExcelFile, showNotification]);

  const handleCreateShortlistCandidates = useCallback(async () => {
    try {
      await createShortlistCandidates();
      showNotification({
        title: 'Success',
        body: 'Shortlist candidates processing started',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to create shortlist candidates',
        icon: '/favicon.ico'
      });
    }
  }, [createShortlistCandidates, showNotification]);

  const handleCreateGmailDraft = useCallback(async () => {
    try {
      await createGmailDraft();
      showNotification({
        title: 'Success',
        body: 'Gmail draft creation started',
        icon: '/favicon.ico'
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        body: 'Failed to create Gmail draft',
        icon: '/favicon.ico'
      });
    }
  }, [createGmailDraft, showNotification]);

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    return (
      <Modal isClosable={false} size="xl" className="shortlist-edit-modal">
        <Modal.Header>
          <StyledHeaderContainer>
            <StyledTitle>Create Shortlist PDF and Excel</StyledTitle>
            <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
          </StyledHeaderContainer>
        </Modal.Header>
        <Modal.Content>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Loading shortlist data...
          </div>
        </Modal.Content>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isClosable={false} size="xl" className="shortlist-edit-modal">
        <Modal.Header>
          <StyledHeaderContainer>
            <StyledTitle>Create Shortlist PDF and Excel</StyledTitle>
            <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
          </StyledHeaderContainer>
        </Modal.Header>
        <Modal.Content>
          <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
            Error: {error}
          </div>
        </Modal.Content>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal isClosable={false}  size="xl" className="shortlist-edit-modal">
      <Modal.Header>
        <StyledHeaderContainer>
          <StyledTitle>Create Shortlist PDF and Excel</StyledTitle>
          <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
        </StyledHeaderContainer>
      </Modal.Header>
      <Modal.Content>
        <StyledModalContent>
        <StyledTableContainer>
          <HotTable
            ref={tableRef}
            data={shortlistData}
            columns={columns}
            colHeaders={true}
            rowHeaders={true}
            height="100%"
            width="100%"
            themeName="ht-theme-main"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            readOnly={false}
            className="htCenter"
            columnSorting={false}
            copyPaste={true}
            selectionMode="range"
            autoWrapRow={false}
            autoWrapCol={false}
            autoRowSize={false}
            rowHeights={30}
            manualRowResize={true}
            manualColumnResize={true}
            manualColumnMove={true}
            filters={true}
            dropdownMenu={true}
            customBorders={true}
            outsideClickDeselects={false}
            enterBeginsEditing={true}
            enterMoves={{ row: 1, col: 0 }}
            fillHandle={true}
            persistentState={true}
            afterChange={afterChangeHandler}
            afterSelectionEnd={afterSelectionEndHandler}
          />
        </StyledTableContainer>
        </StyledModalContent>
      </Modal.Content>
      <StyledModalFooter>
        <StyledStatusText>
          {shortlistData.length} candidates selected
        </StyledStatusText>
        
        <StyledActionButtons>
          <StyledPrimaryActions>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleDownloadResumes}
              disabled={isDownloading}
              Icon={IconDownload}
              title="Download candidate resumes as ZIP file"
            >
              Download Resumes
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleDownloadDocument}
              disabled={isDownloading}
              Icon={IconFileText}
              title="Generate and download PDF report (processes candidates first)"
            >
              Export PDF
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleDownloadDocumentQuick}
              disabled={isDownloadingQuick || isDownloading}
              Icon={IconFileText}
              title="Generate and download PDF report from existing shortlist data (no processing)"
            >
              Export PDF (Quick)
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleDownloadExcel}
              disabled={isDownloading}
              Icon={IconTable}
              title="Export data to Excel spreadsheet"
            >
              Export Excel
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleCreateShortlistCandidates}
              disabled={isCreatingShortlist || isDownloading}
              Icon={IconUsers}
              title="Process and create shortlist candidates"
            >
              Process Candidates
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleCreateGmailDraft}
              disabled={isCreatingDraft || isDownloading}
              Icon={IconMail}
              title="Create Gmail draft with candidate details"
            >
              Create Email Draft
            </Button>
          </StyledPrimaryActions>
          
          <StyledSecondaryActions>
            <Button 
              title="Cancel and close modal" 
              accent="danger" 
              variant="secondary" 
              size="medium" 
              onClick={onClose} 
              Icon={IconX}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="medium"
              onClick={handleSave}
              disabled={isSaving}
              title="Save changes and create shortlist"
              Icon={IconDeviceFloppy}
            >
              Save & Create Shortlist
            </Button>
          </StyledSecondaryActions>
        </StyledActionButtons>
      </StyledModalFooter>
    </Modal>
  );
};
