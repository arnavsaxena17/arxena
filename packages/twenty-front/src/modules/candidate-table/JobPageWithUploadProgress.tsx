import { UploadProgressProvider } from '@/websocket-context/UploadProgressProvider';
import React from 'react';
import { JobPage } from './JobPage';

/**
 * JobPage component wrapped with UploadProgressProvider
 * 
 * This wrapper ensures that upload progress tracking is only active
 * when the JobPage is being used, rather than globally in the app.
 */
export const JobPageWithUploadProgress: React.FC = () => {
  return (
    <UploadProgressProvider>
      <JobPage />
    </UploadProgressProvider>
  );
};
