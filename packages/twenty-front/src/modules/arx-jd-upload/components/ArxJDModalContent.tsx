import { useTheme } from '@emotion/react';
import { CircularProgressBar } from 'twenty-ui';

import { ParsedJD } from '../types/ParsedJD';
import { ArxJDStepperContainer } from './ArxJDStepperContainer';
import { UploadForm } from './UploadForm';

type ArxJDModalContentProps = {
  parsedJD: ParsedJD | null;
  setParsedJD: (jd: ParsedJD | null) => void;
  isUploading: boolean;
  error: string | null;
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  handleFileUpload?: (files: File[]) => Promise<void>;
};

export const ArxJDModalContent = ({
  parsedJD,
  setParsedJD,
  isUploading,
  error,
  getRootProps,
  getInputProps,
  isDragActive,
  onCancel,
  onSubmit,
  handleFileUpload,
}: ArxJDModalContentProps) => {
  const theme = useTheme();

  // Show loading state when uploading a file
  if (isUploading === true) {
    return (
      <div style={{ textAlign: 'center' }}>
        <CircularProgressBar size={32} />
        <div style={{ marginTop: 16 }}>Uploading & analyzing JD...</div>
      </div>
    );
  }

  // If no parsedJD (initial state or error), show the upload form
  if (parsedJD === null) {
    return (
      <UploadForm
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isUploading={false} // Explicitly set to false since we're in the null parsedJD branch
        error={error}
        theme={theme}
      />
    );
  }

  // Only show the stepper container when we have a valid parsedJD
  return (
    <ArxJDStepperContainer
      parsedJD={parsedJD}
      setParsedJD={setParsedJD}
      onCancel={onCancel}
      onSubmit={onSubmit}
      showFooter={true}
      getRootProps={getRootProps}
      getInputProps={getInputProps}
      isDragActive={isDragActive}
      isUploading={false} // Explicitly set to false since we're in the parsed state
      error={null} // Reset error state once we have a valid parsedJD
      handleFileUpload={handleFileUpload}
    />
  );
};
