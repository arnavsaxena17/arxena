import React from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

import { spreadsheetImportDialogState } from '@/spreadsheet-import/states/spreadsheetImportDialogState';
import { useUploadProgressSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useUploadProgressSnackBar';

import { matchColumnsState } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import { SpreadsheetImport } from './SpreadsheetImport';

type SpreadsheetImportProviderProps = React.PropsWithChildren;

export const SpreadsheetImportProvider = (
  props: SpreadsheetImportProviderProps,
) => {
  const [spreadsheetImportDialog, setSpreadsheetImportDialog] = useRecoilState(
    spreadsheetImportDialogState,
  );

  const setMatchColumnsState = useSetRecoilState(matchColumnsState);
  
  // Initialize upload progress snackbar to listen for upload progress events
  // This persists even when the modal closes, so we can receive progress updates
  useUploadProgressSnackBar();

  const handleClose = () => {
    setSpreadsheetImportDialog({
      isOpen: false,
      options: null,
    });

    setMatchColumnsState([]);
  };

  return (
    <>
      {props.children}
      {spreadsheetImportDialog.isOpen && spreadsheetImportDialog.options && (
        <SpreadsheetImport
          isOpen={true}
          onClose={handleClose}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...spreadsheetImportDialog.options}
        />
      )}
    </>
  );
};
