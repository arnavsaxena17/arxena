import { useUploadProgressSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useUploadProgressSnackBar';
import React from 'react';

/**
 * Global Upload Progress Provider
 * 
 * This provider ensures that upload progress tracking persists across component unmounts.
 * It should be placed high in the component tree to avoid cleanup during uploads.
 * 
 * The provider automatically:
 * - Establishes SSE connection for upload progress
 * - Shows snackbars for upload progress updates
 * - Handles connection errors and reconnection
 * - Persists throughout the entire upload process
 */
export const UploadProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This hook automatically manages upload progress snackbars
  // It listens to upload progress events and shows appropriate snackbars
  // The connection will persist as long as this provider is mounted
  useUploadProgressSnackBar();

  return <>{children}</>;
};
