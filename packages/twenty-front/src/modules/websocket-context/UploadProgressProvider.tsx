import { useUploadProgressSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useUploadProgressSnackBar';
import React from 'react';

/**
 * Global Upload Progress Provider
 *
 * Kept at app level so the SSE connection and snackbars persist if the user navigates
 * during an upload (e.g. from JobPage to another route). Uploads can start from
 * JobPage, CandidateSearchModal, OrgChartAddToJobModal, or spreadsheet import;
 * moving this provider lower would unmount it on navigation and drop progress.
 *
 * The provider automatically:
 * - Establishes SSE connection for upload progress
 * - Shows snackbars for upload progress updates
 * - Handles connection errors and reconnection
 */
export const UploadProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This hook automatically manages upload progress snackbars
  // It listens to upload progress events and shows appropriate snackbars
  // The connection will persist as long as this provider is mounted
  useUploadProgressSnackBar();

  return <>{children}</>;
};
