import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { ProcessedData } from '@/candidate-table/ProcessedData';
import { tableStateAtom } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { saveAs } from 'file-saver';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import * as XLSX from 'xlsx';

export const useDownloadAsExcelAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => {
  const { enqueueSnackBar } = useSnackBar();
  const tableState = useRecoilValue(tableStateAtom);
  const [isDownloadExcelModalOpen, setIsDownloadExcelModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const resetState = useCallback(() => {
    setIsDownloading(false);
  }, []);

  const handleDownloadExcelClick = useCallback(async () => {
    if (isDownloading) {
      enqueueSnackBar('An export is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsDownloading(true);

      // Get processed data using the ProcessedData function
      const processedData = ProcessedData({ 
        rawData: tableState.rawData, 
        selectedRowIds: tableState.selectedRowIds 
      });

      if (!processedData || processedData.length === 0) {
        throw new Error('No data available to export');
      }

      // Remove the checkbox column as it's not needed in the export
      const dataForExport = processedData.map(record => {
        const { checkbox, ...rest } = record;
        return rest;
      });

      // Convert data to worksheet
      const ws = XLSX.utils.json_to_sheet(dataForExport);

      // Create workbook and add the worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Save file
      saveAs(blob, 'candidates.xlsx');

      enqueueSnackBar(`Successfully exported ${dataForExport.length} records to Excel`, {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });

      setIsDownloadExcelModalOpen(false);
    } catch (error) {
      console.error('Error exporting table data:', error);
      enqueueSnackBar(error instanceof Error ? error.message : 'Error exporting table data', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, tableState.rawData, tableState.selectedRowIds, enqueueSnackBar]);

  const onClick = () => {
    resetState();
    setIsDownloadExcelModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isDownloadExcelModalOpen}
      setIsOpen={(isOpen) => {
        setIsDownloadExcelModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title="Download as Excel"
      subtitle="Are you sure you want to download the table data as Excel?"
      onConfirmClick={handleDownloadExcelClick}
      deleteButtonText="Download"
      confirmButtonAccent="blue"
      loading={isDownloading}
    />
  );

  return {
    shouldBeRegistered: true,
    onClick,
    ConfirmationModal: confirmationModal,
    isLoading: isDownloading,
  };
}; 