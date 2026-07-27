import { ProcessedData } from '@/candidate-table/ProcessedData';
import { tableStateAtom } from '@/candidate-table/states/states';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_DOWNLOAD_EXCEL_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { saveAs } from 'file-saver';
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';

export const ArxDownloadAsExcelCommand = () => {
  const tableState = useAtomStateValue(tableStateAtom);
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_DOWNLOAD_EXCEL_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleExecute = useCallback(async () => {
    if (isDownloading) {
      enqueueWarningSnackBar({
        message: 'An export is already in progress',
        options: { duration: 3000 },
      });
      return;
    }

    try {
      setIsDownloading(true);

      const processedData = ProcessedData({
        rawData: tableState.rawData,
        selectedRowIds: tableState.selectedRowIds,
      });

      if (!processedData || processedData.length === 0) {
        throw new Error('No data available to export');
      }

      const dataForExport = processedData
        .filter((record) => record.checkbox)
        .map((record) => {
          const { checkbox: _checkbox, ...rest } = record;
          return rest;
        });

      if (dataForExport.length === 0) {
        throw new Error('No selected records to export');
      }

      const worksheet = XLSX.utils.json_to_sheet(dataForExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');

      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      saveAs(blob, 'candidates.xlsx');

      enqueueSuccessSnackBar({
        message: `Successfully exported ${dataForExport.length} records to Excel`,
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Error exporting table data',
        options: { duration: 5000 },
      });
    } finally {
      setIsDownloading(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    isDownloading,
    tableState.rawData,
    tableState.selectedRowIds,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_DOWNLOAD_EXCEL_MODAL_ID}
        title="Download as Excel"
        subtitle="Are you sure you want to download the table data as Excel?"
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Download"
        confirmButtonAccent="blue"
        loading={isDownloading}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
