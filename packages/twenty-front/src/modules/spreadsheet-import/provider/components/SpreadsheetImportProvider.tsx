import React, { useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

import { spreadsheetImportDialogState } from '@/spreadsheet-import/states/spreadsheetImportDialogState';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';

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
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();

  const shouldHoldUploadProgressSse =
    spreadsheetImportDialog.isOpen &&
    spreadsheetImportDialog.options?.enableUploadProgressSseWhileOpen === true;

  useEffect(() => {
    if (!shouldHoldUploadProgressSse) {
      return;
    }
    beginUploadProgressSseSession();
    return () => {
      endUploadProgressSseSessionAfterDelay();
    };
  }, [
    shouldHoldUploadProgressSse,
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  ]);

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
