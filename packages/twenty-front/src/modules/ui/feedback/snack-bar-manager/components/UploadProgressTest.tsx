import React from 'react';
import { Button } from 'twenty-ui';
import { useUploadProgressSnackBar } from '../hooks/useUploadProgressSnackBar';

/**
 * Test component for upload progress functionality
 * This can be temporarily added to test upload progress
 */
export const UploadProgressTest: React.FC = () => {
  const { uploadProgress, isConnected, error, testSnackbar, testBackendProgress } = useUploadProgressSnackBar();

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Upload Progress Test</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Connection Status:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}
      </div>
      
      {error && (
        <div style={{ marginBottom: '10px', color: 'red' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {uploadProgress && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Latest Progress:</strong>
          <pre>{JSON.stringify(uploadProgress, null, 2)}</pre>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button onClick={testSnackbar}>
          Test Snackbar
        </Button>
        <Button onClick={testBackendProgress}>
          Test Backend Progress
        </Button>
      </div>
    </div>
  );
};
