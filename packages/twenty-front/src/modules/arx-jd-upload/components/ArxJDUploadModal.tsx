import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { jobIdAtom } from '@/candidate-table/states';
import { gql, useLazyQuery } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { graphqlToFindManyJobs } from 'twenty-shared';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { useArxJDUpload } from '../hooks/useArxJDUpload';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
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
  const [isLoadingExistingJob, setIsLoadingExistingJob] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentJobId = useRecoilValue(jobIdAtom);
  const isEditMode = Boolean(objectNameSingular === 'job' || (objectNameSingular === 'candidate' && currentJobId));
  const jobIdToFetch = objectNameSingular === 'job' ? objectRecordId : currentJobId;

  const {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleCreateJob,
    resetUploadState,
    updateRecruiterDetails,
  } = useArxJDUpload(objectNameSingular);

  const { reset: resetFormStepper } = useArxJDFormStepper();

  // Track the previous open state to detect when the modal is first opened
  const prevOpenStateRef = useRef(false);
  // Track if we've done the stepper reset to avoid loops
  const didStepperResetRef = useRef(false);
  // Track if we've already fetched the job data
  const jobDataFetchedRef = useRef(false);

  // Setup the query to fetch job data
  const [executeJobQuery] = useLazyQuery(gql`
    ${graphqlToFindManyJobs}
  `);

  // Function to fetch job data for editing
  const fetchJobData = async () => {
    if (!jobIdToFetch || !isEditMode || jobDataFetchedRef.current) return;
    
    try {
      setIsLoadingExistingJob(true);
      setLoadError(null);
      
      const { data } = await executeJobQuery({
        variables: {
          filter: { id: { in: [jobIdToFetch] } },
          limit: 1,
        },
      });
      
      if (data?.jobs?.edges?.[0]?.node) {
        const jobData = data.jobs.edges[0].node;
        console.log('Fetched job data:', jobData);
        
        // Get chat flow order preferences
        const chatFlowOrder = jobData.chatFlowOrder || [];
        const hasVideoInterview = chatFlowOrder.includes('startVideoInterviewChat');
        const hasMeetingScheduling = chatFlowOrder.includes('startMeetingSchedulingChat');
        
        // Get questions
        const chatQuestions = jobData.questions?.edges?.map(
          (edge: any) => edge.node.name
        ) || [];
        
        // Get video interview questions
        const videoQuestions = jobData.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.map(
          (edge: any) => edge.node.questionValue
        ) || [];
        
        // Get meeting schedule info
        const meetingType = jobData.interviewSchedule?.edges?.[0]?.node?.meetingType || 'online';
        // Format available dates if needed
        const availableDates = jobData.interviewSchedule?.edges?.[0]?.node?.slotsAvailable || [];
        
        // Create a parsed JD from the job data
        const parsedData = createDefaultParsedJD({
          id: jobData.id,
          name: jobData.name || '',
          description: jobData.description || '',
          jobCode: jobData.jobCode || '',
          jobLocation: jobData.jobLocation || '',
          salaryBracket: jobData.salaryBracket || '',
          isActive: jobData.isActive !== undefined ? jobData.isActive : true,
          companyId: jobData.companyId,
          companyName: jobData.company?.name,
          chatFlow: {
            order: {
              initialChat: true,
              videoInterview: hasVideoInterview,
              meetingScheduling: hasMeetingScheduling,
            },
            questions: chatQuestions.length > 0 ? chatQuestions : undefined,
          },
          videoInterview: {
            questions: videoQuestions.length > 0 ? videoQuestions : undefined,
          },
          meetingScheduling: {
            meetingType,
            availableDates,
          },
        });
        
        setParsedJD(parsedData);
        
        // Don't skip the upload step, stay at step 0
        setTimeout(() => {
          resetFormStepper(0);
        }, 0);
        
      } else {
        setLoadError('Could not find the job data');
      }
      
      jobDataFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching job data:', error);
      setLoadError('Failed to load job data');
    } finally {
      setIsLoadingExistingJob(false);
    }
  };

  // Reset effect only runs on modal open transition
  useEffect(() => {
    // Only run on transition from closed to open
    if (isArxUploadJDModalOpen && !prevOpenStateRef.current) {
      // In edit mode, fetch the job data
      if (isEditMode && jobIdToFetch) {
        jobDataFetchedRef.current = false;
        fetchJobData();
      } else {
        // In create mode, reset upload state
        resetUploadState();
      }

      // Reset the stepper state flag
      didStepperResetRef.current = false;
    }

    // Update the previous state ref
    prevOpenStateRef.current = isArxUploadJDModalOpen;
  }, [isArxUploadJDModalOpen, resetUploadState, isEditMode, jobIdToFetch, fetchJobData]);

  // Separate effect to reset the form stepper only after the first render
  // This prevents circular dependencies with Recoil state updates
  useEffect(() => {
    if (isArxUploadJDModalOpen && !didStepperResetRef.current) {
      // Use setTimeout to ensure this happens after the current render cycle
      const timeoutId = setTimeout(() => {
        // Always reset to step 0 (Upload JD), regardless of mode
        resetFormStepper(0);
        didStepperResetRef.current = true;
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [isArxUploadJDModalOpen, resetFormStepper]);

  // Close modal and reset state
  const closeModal = () => {
    console.log('closeModal');
    setIsArxUploadJDModalOpen(false);
  };

  const handleSubmit = async () => {
    console.log('handleSubmit');
    const success = await handleCreateJob();
    console.log('success has been returned', success);
    if (success === true) {
      console.log('success is true, closing modal');
      closeModal();
    }
  };

  // Don't render anything if the modal isn't open
  if (!isArxUploadJDModalOpen) {
    return null;
  }

  // Determine modal title based on mode
  const modalTitle = isEditMode ? "Edit Job Details" : "Upload Job Description";

  return (
    <ArxJDUploadDropzone onDrop={handleFileUpload}>
      {({ getRootProps, getInputProps, isDragActive }) => (
        <ArxJDModalLayout
          isOpen={true}
          title={modalTitle}
          onClose={closeModal}
          footer={null}
        >
          <ArxJDModalContent
            parsedJD={parsedJD}
            setParsedJD={setParsedJD}
            isUploading={isUploading || isLoadingExistingJob}
            error={error || loadError}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            onCancel={closeModal}
            onSubmit={handleSubmit}
            handleFileUpload={handleFileUpload}
            onRecruiterInfoChange={updateRecruiterDetails}
            isEditMode={isEditMode}
          />
        </ArxJDModalLayout>
      )}
    </ArxJDUploadDropzone>
  );
};
