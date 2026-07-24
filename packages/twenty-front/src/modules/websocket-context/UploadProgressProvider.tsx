import { useUploadProgressSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useUploadProgressSnackBar';
import React from 'react';

/**
 * Global Upload Progress Provider
 *
 * Kept at app level so snackbars and session state persist if the user navigates during an
 * upload. SSE to `/upload-progress/stream` opens only while an upload session is active
 * (see `useUploadProgressSseSession`), not for the whole logged-in session.
 *
 * The provider automatically:
 * - Subscribes to upload progress when a session begins (spreadsheet import, upload-profiles, resume-upload, etc.)
 * - Shows snackbars for upload progress updates
 * - Handles connection errors and reconnection while a session is active
 */
export const UploadProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This hook automatically manages upload progress snackbars
  // It listens to upload progress events and shows appropriate snackbars
  // The connection will persist as long as this provider is mounted
  useUploadProgressSnackBar();

  return <>{children}</>;
};
