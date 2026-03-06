import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { useUploadProgress } from '../../../../websocket-context/useUploadProgress';

export const useUploadProgressSnackBar = () => {
  const { enqueueSnackBar } = useSnackBar();
  const { uploadProgress, isConnected, error } = useUploadProgress();
  const currentSnackBarId = useRef<string | null>(null);
  const refreshDataFunction = useRecoilValue(dataTableRefreshFunctionState);
  const lastProcessedBatch = useRef<number>(0);

  useEffect(() => {
    if (!uploadProgress) return;

    console.log('🎯 [useUploadProgressSnackBar] Received upload progress:', uploadProgress);
    const { step, message, progress_percentage, total_candidates, processed_candidates, current_batch, total_batches } = uploadProgress;

    // Handle different progress steps
    console.log('🎯 [useUploadProgressSnackBar] Processing step:', step);
    switch (step) {
      case 'started':
        // Reset batch tracking for new upload
        lastProcessedBatch.current = 0;
        
        // Show initial upload started notification
        console.log('🎯 [useUploadProgressSnackBar] Showing started snackbar');
        enqueueSnackBar(
          'Upload Started',
          {
            variant: SnackBarVariant.Info,
            showProgressBar: true,
            progress: 0,
            progressMessage: `Processing ${total_candidates || 0} candidates in ${total_batches || 0} batches`,
            duration: 2000, // Don't auto-close
          }
        );
        // Generate a unique ID for tracking (since enqueueSnackBar doesn't return one)
        currentSnackBarId.current = `upload-started-${Date.now()}`;
        break;

      case 'processing':
        // Check if a new batch has been completed
        const currentBatch = current_batch || 0;
        if (currentBatch > lastProcessedBatch.current && lastProcessedBatch.current > 0) {
          // A batch has been completed, trigger data refresh
          if (refreshDataFunction) {
            console.log(`🔄 [useUploadProgressSnackBar] Batch ${lastProcessedBatch.current} completed, triggering data refresh`);
            refreshDataFunction().catch((error) => {
              console.error('❌ [useUploadProgressSnackBar] Failed to refresh data after batch completion:', error);
            });
          } else {
            console.warn('⚠️ [useUploadProgressSnackBar] No refresh function available to call after batch completion');
          }
        }
        
        // Update the last processed batch
        lastProcessedBatch.current = currentBatch;
        
        // Update existing snackbar with progress
        enqueueSnackBar(
          'Uploading Candidates',
          {
            variant: SnackBarVariant.Info,
            showProgressBar: true,
            progress: progress_percentage || 0,
              progressMessage: `Processing batch ${current_batch || 0}/${total_batches || 0} - ${processed_candidates || 0}/${total_candidates || 0} candidates`,
          }
        );
        currentSnackBarId.current = `upload-processing-${Date.now()}`;
        break;

      case 'completed':
        // Show completion notification
        enqueueSnackBar(
          'Upload Completed',
          {
            variant: SnackBarVariant.Success,
            showProgressBar: true,
            progress: 100,
            progressMessage: `Successfully processed ${total_candidates || 0} candidates`,
          }
        );
        currentSnackBarId.current = `upload-completed-${Date.now()}`;
        
        // Trigger data refresh after upload completion
        if (refreshDataFunction) {
          console.log('🔄 [useUploadProgressSnackBar] Triggering data refresh after upload completion');
          refreshDataFunction().catch((error) => {
            console.error('❌ [useUploadProgressSnackBar] Failed to refresh data after upload completion:', error);
          });
        } else {
          console.warn('⚠️ [useUploadProgressSnackBar] No refresh function available to call after upload completion');
        }
        break;

      case 'error':
        // Show error notification
        enqueueSnackBar(
          'Upload Failed',
          {
            variant: SnackBarVariant.Error,
            showProgressBar: false,
            progressMessage: message,
          }
        );
        currentSnackBarId.current = `upload-error-${Date.now()}`;
        break;

      default:
        // Handle other steps or unknown steps
        enqueueSnackBar(
          message || 'Upload Progress',
          {
            variant: SnackBarVariant.Info,
            showProgressBar: true,
            progress: progress_percentage || 0,
              progressMessage: `Batch ${current_batch || 0}/${total_batches || 0} - ${processed_candidates || 0}/${total_candidates || 0} candidates`,
            duration: 0, // Don't auto-close
          }
        );
        currentSnackBarId.current = `upload-default-${Date.now()}`;
        break;
    }
  }, [uploadProgress, enqueueSnackBar]);

  // Handle connection errors
  useEffect(() => {
    if (error && currentSnackBarId.current) {
      enqueueSnackBar(
        'Upload Progress Connection Error',
        {
          variant: SnackBarVariant.Error,
          showProgressBar: false,
          progressMessage: 'Lost connection to upload progress updates',
          duration: 2000,
        }
      );
      currentSnackBarId.current = `upload-connection-error-${Date.now()}`;
    }
  }, [error, enqueueSnackBar]);

  // Test function to manually trigger a snackbar (for debugging)
  const testSnackbar = () => {
    console.log('🧪 [useUploadProgressSnackBar] Testing snackbar...');
    enqueueSnackBar(
      'Test Upload Progress',
      {
        variant: SnackBarVariant.Info,
        showProgressBar: true,
        progress: 50,
        progressMessage: 'Testing progress bar functionality',
        duration: 2000,
      }
    );
  };

  // Test function to trigger backend upload progress events
  const testBackendProgress = async () => {
    try {
      console.log('🧪 [useUploadProgressSnackBar] Testing backend progress...');
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/upload-progress/test-publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      console.log('🧪 [useUploadProgressSnackBar] Backend test result:', result);
    } catch (error) {
      console.error('🧪 [useUploadProgressSnackBar] Backend test error:', error);
    }
  };

  return {
    uploadProgress,
    isConnected,
    error,
    testSnackbar, // Expose test function
    testBackendProgress, // Expose backend test function
  };
};
