import { useTheme } from '@emotion/react';
import { CircularProgressBar } from 'twenty-ui';

import { ParsedJD } from '../types/ParsedJD';
import { ArxJDStepperContainer } from './ArxJDStepperContainer';
import { RecruiterDetails } from './JobDetailsForm';
import { UploadForm } from './UploadForm';

type ArxJDModalContentProps = {
  parsedJD: ParsedJD | null;
  setParsedJD: (jd: ParsedJD) => void;
  isUploading: boolean;
  error: string | null;
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  handleFileUpload?: (files: File[]) => Promise<void>;
  handleFileRemoval?: () => Promise<void>;
  onCreateJobFromName?: (jobName: string) => Promise<void>;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
  isEditMode?: boolean;
  onAssistantThreadUpdate?: (
    assistantThreads: {
      id: string;
      name: string;
      assistantParameters?: any;
      enrichmentConfigs?: any[];
      columnFilters?: any[];
    }[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
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
  handleFileRemoval,
  onCreateJobFromName,
  onRecruiterInfoChange,
  isEditMode = false,
  onAssistantThreadUpdate,
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

  if (parsedJD === null) {
    return (
      <UploadForm
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isUploading={false}
        error={error}
        theme={theme}
        uploadButtonLabel={isEditMode ? "Replace File" : "Upload File"}
        onCreateJobFromName={onCreateJobFromName}
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
      handleFileRemoval={handleFileRemoval}
      isOpen={true}
      onClose={onCancel}
      title="Add a New Job Description"
      onRecruiterInfoChange={onRecruiterInfoChange}
      isEditMode={isEditMode}
      onCreateJobFromName={onCreateJobFromName}
      onAssistantThreadUpdate={onAssistantThreadUpdate}
    />
  );
};
