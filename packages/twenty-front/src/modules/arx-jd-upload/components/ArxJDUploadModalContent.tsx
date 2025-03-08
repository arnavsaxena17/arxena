import { useTheme } from '@emotion/react';
import { Dispatch, SetStateAction, useEffect } from 'react';
import { DropzoneInputProps, DropzoneRootProps } from 'react-dropzone';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { ParsedJD } from '../types/ParsedJD';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
import { ArxJDErrorDisplay } from './ArxJDErrorDisplay';
import { ArxJDStepperContainer } from './ArxJDStepperContainer';
import { ArxJDUploadingState } from './ArxJDUploadingState';
import { UploadForm } from './UploadForm';

type ArxJDUploadModalContentProps = {
  isUploading: boolean;
  error: string | null;
  parsedJD: ParsedJD | null;
  setParsedJD: Dispatch<SetStateAction<ParsedJD | null>>;
  closeModal: () => void;
  handleCreateJob: () => Promise<boolean | void>;
  getRootProps: () => DropzoneRootProps;
  getInputProps: () => DropzoneInputProps;
  isDragActive: boolean;
  handleFileUpload: (files: File[]) => Promise<void>;
};

export const ArxJDUploadModalContent = ({
  isUploading,
  error,
  parsedJD,
  setParsedJD,
  closeModal,
  handleCreateJob,
  getRootProps,
  getInputProps,
  isDragActive,
  handleFileUpload,
}: ArxJDUploadModalContentProps) => {
  const theme = useTheme();
  const { reset: resetFormStepper } = useArxJDFormStepper();

  // Reset the form stepper when a JD is parsed (when parsedJD becomes non-null)
  useEffect(() => {
    // This will only run when parsedJD changes from null to a value
    if (parsedJD !== null) {
      console.log('JD parsed successfully, resetting form stepper', parsedJD);
      resetFormStepper(0);
    }
  }, [parsedJD, resetFormStepper]);

  console.log('Current state:', { isUploading, error, parsedJD });

  if (isUploading) {
    return <ArxJDUploadingState />;
  }

  if (error !== null) {
    return <ArxJDErrorDisplay error={error} />;
  }

  if (parsedJD === null) {
    return (
      <UploadForm
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isUploading={isUploading}
        error={error}
        theme={theme}
      />
    );
  }

  // Ensure we have a valid parsedJD structure with defaults
  const validParsedJD = createDefaultParsedJD(parsedJD);

  return (
    <ArxJDStepperContainer
      parsedJD={validParsedJD}
      setParsedJD={setParsedJD}
      onCancel={closeModal}
      onSubmit={handleCreateJob}
      getRootProps={getRootProps}
      getInputProps={getInputProps}
      isDragActive={isDragActive}
      isUploading={isUploading}
      error={error}
      handleFileUpload={handleFileUpload}
      isOpen={true}
      onClose={closeModal}
      title="Upload Job Description"
    />
  );
};
