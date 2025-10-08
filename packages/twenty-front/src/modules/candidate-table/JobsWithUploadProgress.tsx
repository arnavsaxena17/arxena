import { UploadProgressProvider } from '@/websocket-context/UploadProgressProvider';
import React from 'react';
import { Jobs } from './Jobs';

/**
 * Jobs component wrapped with UploadProgressProvider
 * 
 * This wrapper ensures that upload progress tracking is only active
 * when the Jobs page is being used, rather than globally in the app.
 */
export const JobsWithUploadProgress: React.FC = () => {
  return (
    <UploadProgressProvider>
      <Jobs />
    </UploadProgressProvider>
  );
};
