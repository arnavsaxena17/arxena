import React from 'react';
import { useUploadProgressSnackBar } from '../hooks/useUploadProgressSnackBar';

/**
 * Demo component showing how to use the upload progress snackbar
 * This component should be included in your app to enable upload progress tracking
 */
export const UploadProgressDemo: React.FC = () => {
  // This hook automatically manages upload progress snackbars
  // It listens to upload progress events and shows appropriate snackbars
  useUploadProgressSnackBar();

  // This component doesn't render anything visible
  // It just sets up the upload progress tracking
  return null;
};

export default UploadProgressDemo;
