import { tokenPairState } from '@/auth/states/tokenPairState';
import { useNotification } from '@/notification-context/NotificationContextProvider';
import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import { HotTable } from '@handsontable/react-wrapper';
import { CellChange, ChangeSource } from 'handsontable/common';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, IconDeviceFloppy, IconDownload, IconFileText, IconTable, IconX } from 'twenty-ui';
import { useShortlistEditModal } from '../hooks/useShortlistEditModal';

const StyledModalContent = styled.div`
  padding: 0;
  height: 600px;
  display: flex;
  flex-direction: column;
`;

const StyledTableContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  
  .handsontable {
    overflow: visible;
  }
`;


const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: center;
  flex-wrap: wrap;
  min-height: 60px;
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledModalFooter = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  min-height: 60px;
  overflow: visible;
  padding: ${({ theme }) => theme.spacing(5)};
  flex-wrap: wrap;
`;

const StyledStatusText = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
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
    downloadExcelFile,
    isSaving,
    isDownloading
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

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    return (
      <Modal isClosable={false} size="large" className="shortlist-edit-modal">
        <Modal.Header>
          <div>Create Shortlist PDF and Excel</div>
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
      <Modal isClosable={false} size="large" className="shortlist-edit-modal">
        <Modal.Header>
          <div>Create Shortlist PDF and Excel</div>
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
    <Modal isClosable={false} size="large" className="shortlist-edit-modal">
      <Modal.Header>
        <div>Create Shortlist PDF and Excel</div>
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
        <StyledButtonGroup>
          <StyledStatusText>
            {shortlistData.length} candidates selected
          </StyledStatusText>
          <Button
            variant="secondary"
            size="medium"
            onClick={handleDownloadResumes}
            disabled={isDownloading}
            Icon={IconDownload}
            title="Download Resumes"
          />
          <Button
            variant="secondary"
            size="medium"
            onClick={handleDownloadDocument}
            disabled={isDownloading}
            Icon={IconFileText}
            title="Download PDF"
          />
          <Button
            variant="secondary"
            size="medium"
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            Icon={IconTable}
            title="Download Excel"
          />
          <Button title="Cancel" accent="danger" variant="secondary" size="medium" onClick={onClose} Icon={IconX}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={handleSave}
            disabled={isSaving}
            title="Save & Create Shortlist"
            Icon={IconDeviceFloppy}
          >
            
            
          </Button>
        </StyledButtonGroup>
      </StyledModalFooter>
    </Modal>
  );
};
