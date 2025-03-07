// src/components/UploadProgressIndicator.tsx
import styled from '@emotion/styled';
import React from 'react';
import { useUploadContext } from './components/VideoInterviewFlow';

const ProgressContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 12px;
  z-index: 1000;
  min-width: 250px;
  max-width: 320px;
`;

const ProgressBar = styled.div<{ progress: number }>`
  height: 8px;
  background-color: #3498db;
  width: ${props => props.progress}%;
  border-radius: 4px;
`;

const ProgressTrack = styled.div`
  height: 8px;
  background-color: #e0e0e0;
  width: 100%;
  border-radius: 4px;
  margin: 8px 0;
`;

const UploadItem = styled.div`
  margin-bottom: 12px;
`;

const FileName = styled.div`
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
`;

const ProgressText = styled.div`
  font-size: 12px;
  color: #666;
  text-align: right;
`;

export const UploadProgressIndicator: React.FC = () => {
  const { pendingUploads } = useUploadContext();
  
  if (pendingUploads.length === 0) {
    return null;
  }
  
  return (
    <ProgressContainer>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Uploading Responses</h4>
      {pendingUploads.map(upload => (
        <UploadItem key={upload.id}>
          <FileName>{upload.filename}</FileName>
          <ProgressTrack>
            <ProgressBar progress={upload.progress} />
          </ProgressTrack>
          <ProgressText>{upload.progress}%</ProgressText>
        </UploadItem>
      ))}
    </ProgressContainer>
  );
};