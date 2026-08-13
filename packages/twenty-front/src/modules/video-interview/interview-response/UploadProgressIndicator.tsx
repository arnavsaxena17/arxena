import { styled } from '@linaria/react';
import React from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type PendingUpload = {
  id: string;
  filename: string;
  progress: number;
};

const useUploadContext = (): { pendingUploads: PendingUpload[] } => ({
  pendingUploads: [],
});

const ProgressContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  bottom: 20px;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  max-width: 320px;
  min-width: 250px;
  padding: 12px;
  position: fixed;
  right: 20px;
  z-index: 1000;
`;

const ProgressBar = styled.div<{ progress: number }>`
  background-color: #3498db;
  border-radius: 4px;
  height: 8px;
  width: ${(props) => props.progress}%;
`;

const ProgressTrack = styled.div`
  background-color: #e0e0e0;
  border-radius: 4px;
  height: 8px;
  margin: 8px 0;
  width: 100%;
`;

const UploadItem = styled.div`
  margin-bottom: 12px;
`;

const FileName = styled.div`
  font-size: 14px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProgressText = styled.div`
  color: #666;
  font-size: 12px;
  text-align: right;
`;

export const UploadProgressIndicator: React.FC = () => {
  const { pendingUploads } = useUploadContext();

  if (pendingUploads.length === 0) {
    return null;
  }

  return (
    <ProgressContainer>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
        Uploading Responses
      </h4>
      {pendingUploads.map((upload) => (
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
