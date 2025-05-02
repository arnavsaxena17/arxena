import { useTheme } from '@emotion/react';
import { CircularProgressBar } from 'twenty-ui';

import { ParsedJD } from '../types/ParsedJD';
import { ArxJDStepperContainer } from './ArxJDStepperContainer';
import { RecruiterDetails } from './JobDetailsForm';
import { UploadForm } from './UploadForm';

type ArxJDModalContentProps = {
  parsedJD: ParsedJD;
  setParsedJD: (jd: ParsedJD) => void;
  isUploading: boolean;
  error: string | null;
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  handleFileUpload?: (files: File[]) => Promise<void>;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
  isEditMode?: boolean;
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
  onRecruiterInfoChange,
  isEditMode = false,
}: ArxJDModalContentProps) => {
  const theme = useTheme();

  console.log('ArxJDModalContent rendering with:', {
    parsedJDExists: parsedJD !== null,
    isUploading,
    error,
    isEditMode
  });

  // Show loading state when uploading a file
  if (isUploading === true) {
    return (
      <div style={{ textAlign: 'center' }}>
        <CircularProgressBar size={32} />
        <div style={{ marginTop: 16 }}>
          {isEditMode ? 'Loading job details...' : 'Uploading & analyzing JD... GPT Calls can take upto 2 minutes'}
        </div>
      </div>
    );
  }

  // If no parsedJD (initial state or error), show the upload form
  // This applies to both create and edit modes
  if (parsedJD === null) {
    return (
      <UploadForm
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isUploading={false} // Explicitly set to false since we're in the null parsedJD branch
        error={error}
        theme={theme}
        uploadButtonLabel={isEditMode ? "Replace File" : "Upload File"}
      />
    );
  }

  // Either we have a valid parsedJD or we're in edit mode waiting for data
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
      isUploading={false}
      error={null}
      handleFileUpload={handleFileUpload}
      isOpen={true}
      onClose={onCancel}
      title="Job Description"
      onRecruiterInfoChange={onRecruiterInfoChange}
      isEditMode={isEditMode}
    />
  );
};
