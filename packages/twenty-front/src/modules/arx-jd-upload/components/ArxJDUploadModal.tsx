import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { useArxJDUpload } from '../hooks/useArxJDUpload';
import { ArxJDModalContent } from './ArxJDModalContent';
import { ArxJDModalLayout } from './ArxJDModalLayout';
import { ArxJDUploadDropzone } from './ArxJDUploadDropzone';

export const ArxJDUploadModal = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [isArxUploadJDModalOpen, setIsArxUploadJDModalOpen] = useRecoilState(
    isArxUploadJDModalOpenState,
  );

  const {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleCreateJob,
    resetUploadState,
  } = useArxJDUpload(objectNameSingular);

  const { reset: resetFormStepper } = useArxJDFormStepper();

  // Track the previous open state to detect when the modal is first opened
  const prevOpenStateRef = useRef(false);
  // Track if we've done the stepper reset to avoid loops
  const didStepperResetRef = useRef(false);

  // Reset effect only runs on modal open transition
  useEffect(() => {
    // Only run on transition from closed to open
    if (isArxUploadJDModalOpen && !prevOpenStateRef.current) {
      // Reset upload state
      resetUploadState();

      // Reset the stepper state flag
      didStepperResetRef.current = false;
    }

    // Update the previous state ref
    prevOpenStateRef.current = isArxUploadJDModalOpen;
  }, [isArxUploadJDModalOpen, resetUploadState]);

  // Separate effect to reset the form stepper only after the first render
  // This prevents circular dependencies with Recoil state updates
  useEffect(() => {
    if (isArxUploadJDModalOpen && !didStepperResetRef.current) {
      // Use setTimeout to ensure this happens after the current render cycle
      const timeoutId = setTimeout(() => {
        resetFormStepper(0);
        didStepperResetRef.current = true;
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [isArxUploadJDModalOpen, resetFormStepper]);

  // Close modal and reset state
  const closeModal = () => {
    setIsArxUploadJDModalOpen(false);
  };

  const handleSubmit = async () => {
    const success = await handleCreateJob();
    if (success === true) {
      closeModal();
    }
  };

  // Don't render anything if the modal isn't open
  if (!isArxUploadJDModalOpen) {
    return null;
  }

  return (
    <ArxJDUploadDropzone onDrop={handleFileUpload}>
      {({ getRootProps, getInputProps, isDragActive }) => (
        <ArxJDModalLayout
          isOpen={true}
          title="Upload Job Description"
          onClose={closeModal}
          footer={null}
        >
          <ArxJDModalContent
            parsedJD={parsedJD}
            setParsedJD={setParsedJD}
            isUploading={isUploading}
            error={error}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            onCancel={closeModal}
            onSubmit={handleSubmit}
            handleFileUpload={handleFileUpload}
          />
        </ArxJDModalLayout>
      )}
    </ArxJDUploadDropzone>
  );
};
