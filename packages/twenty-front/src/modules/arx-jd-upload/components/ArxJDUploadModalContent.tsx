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
}: ArxJDUploadModalContentProps) => {
  const theme = useTheme();
  const { reset: resetFormStepper } = useArxJDFormStepper();

  // Reset the form stepper when a JD is parsed (when parsedJD becomes non-null)
  useEffect(() => {
    // This will only run when parsedJD changes from null to a value
    if (parsedJD !== null) {
      resetFormStepper();
    }
  }, [parsedJD !== null]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Ensure we have a valid parsedJD structure
  const validParsedJD = createDefaultParsedJD(parsedJD);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <ArxJDStepperContainer
        parsedJD={validParsedJD}
        setParsedJD={setParsedJD}
        onCancel={closeModal}
        onSubmit={handleCreateJob}
        showFooter={true}
      />
    </div>
  );
};
