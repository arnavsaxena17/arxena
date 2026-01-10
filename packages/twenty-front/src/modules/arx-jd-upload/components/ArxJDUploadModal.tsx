import { parsedJDInternalState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobIdAtom } from '@/candidate-table/states/states';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import { gql, useLazyQuery } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { graphqlToFindManyJobs } from 'twenty-shared';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { useArxJDUpload } from '../hooks/useArxJDUpload';
import { useJobDescriptionParser } from '../hooks/useJobDescriptionParser';
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
  const [modalMode, setModalMode] = useRecoilState(arxUploadJDModalModeState);
  const setParsedJDInternalState = useSetRecoilState(parsedJDInternalState);
  const [isLoadingExistingJob, setIsLoadingExistingJob] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentJobId = useRecoilValue(jobIdAtom);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { findManyAttachments } = useFindManyAttachments();
  const isEditMode = modalMode === 'edit';
  const jobIdToFetch = objectNameSingular === 'job' ? objectRecordId : currentJobId;
  
  // Debug logging
  console.log('ArxJDUploadModal - modalMode:', modalMode, 'isEditMode:', isEditMode, 'jobIdToFetch:', jobIdToFetch);

  const {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleFileRemoval,
    handleCreateJob,
    handleCreateJobFromName,
    resetUploadState,
    updateRecruiterDetails,
    updateSearchFilterRecord,
    apiKeys,
  } = useArxJDUpload(objectNameSingular, modalMode);

  const { reset: resetFormStepper } = useArxJDFormStepper(0);
  const { parseJobDescriptionFromFile } = useJobDescriptionParser();

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

  // Function to fetch attachments for a job
  const fetchJobAttachments = async (jobId: string) => {
    try {
      const attachments = await findManyAttachments({
        filter: { jobId: { eq: jobId } },
        limit: 1,
      });

      return attachments.length > 0 ? attachments[0] : null;
    } catch (error) {
      console.error('Error fetching job attachments:', error);
      return null;
    }
  };



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
        
        // Fetch attachment and check if parsed job description exists
        let parsedJobDescription: any = null;
        const attachment = await fetchJobAttachments(jobData.id);
        if (attachment?.fullPath) {
          console.log('Found attachment:', attachment.fullPath);
          
          // In edit mode, we don't need to parse the JD again since we already have the job data
          // Just set a placeholder for parsedJobDescription to maintain compatibility
          parsedJobDescription = {
            jobTitle: jobData.name || '',
            company: jobData.company?.name || '',
            location: jobData.jobLocation || '',
            industry: jobData.company?.name || '',
            requiredSkills: [],
            preferredSkills: [],
            experienceLevel: 'mid_level',
            education: [],
            keywords: [],
            responsibilities: [],
            qualifications: [],
            benefits: [],
            employmentType: 'full_time',
            remoteWork: false,
            salaryRange: null,
          };
          console.log('Using existing job data for parsedJobDescription (edit mode):', parsedJobDescription);
        }

        // Get searchFilterId for reference
        let searchFilterId: string | undefined = undefined;
        try {
          console.log('Raw jobData.searchFilter:', jobData?.searchFilter);
          const searchFilterEdges = jobData?.searchFilter?.edges || [];
          console.log('SearchFilter edges:', searchFilterEdges);
          
          if (searchFilterEdges.length > 0) {
            // Get the first search filter ID for reference
            searchFilterId = searchFilterEdges[0]?.node?.id;
            console.log('Found searchFilterId:', searchFilterId);
          }
        } catch (e) {
          console.warn('Failed to get searchFilterId:', e);
        }
        
        // Create a parsed JD from the job data
        console.log('Creating parsedData with searchFilterId:', searchFilterId);
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
          filePath: attachment?.fullPath,
          parsedJobDescription: parsedJobDescription, // Use the fetched ParsedJobDescription
          searchFilters: jobData.searchFilter?.edges?.map((edge: any) => ({
            id: edge.node.id,
            name: edge.node.name,
            searchFilterParameter: edge.node.searchFilterParameter,
            searchFilterName: edge.node.searchFilterName,
            searchFilterFields: edge.node.searchFilterFields,
          })),
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
        
        console.log('Final parsedData with searchFilterId:', {
          searchFilterId: parsedData.searchFilters?.[0]?.id,
          id: parsedData.id,
          note: 'Search parameters are now stored in searchFilters[].searchFilterParameter'
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
      // In edit mode, fetch the job data (only if we have a valid jobIdToFetch)
      if (isEditMode && jobIdToFetch && jobIdToFetch.trim() !== '') {
        jobDataFetchedRef.current = false;
        fetchJobData();
      } else {
        // In create mode, explicitly reset parsedJDInternalState first (synchronously)
        // This ensures the selector returns null immediately on next render
        console.log('ArxJDUploadModal - Resetting state for create mode');
        setParsedJDInternalState(null);
        // Then reset parsedJD and upload state
        setParsedJD(null);
        resetUploadState();
      }

      // Reset the stepper state flag
      didStepperResetRef.current = false;
    }

    // Update the previous state ref
    prevOpenStateRef.current = isArxUploadJDModalOpen;
  }, [isArxUploadJDModalOpen, resetUploadState, isEditMode, jobIdToFetch, fetchJobData, setParsedJD, setParsedJDInternalState]);

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
    setModalMode('create'); // Reset to default mode
    setParsedJDInternalState(null);
    setParsedJD(null);
    resetUploadState();
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

  // Wrapper to close modal after creating job from name
  const handleCreateJobFromNameWithClose = async (jobName: string) => {
    try {
      await handleCreateJobFromName(jobName);
      // Close modal after successful creation (navigation will happen in the hook)
      closeModal();
    } catch (error) {
      // Error is already handled in handleCreateJobFromName
      console.error('Error in handleCreateJobFromNameWithClose:', error);
    }
  };

  // Don't render anything if the modal isn't open
  if (!isArxUploadJDModalOpen) {
    return null;
  }

  // Determine modal title based on mode
  const modalTitle = isEditMode ? "Edit Job Details" : "Upload Job Description";
  console.log('ArxJDUploadModal - modalTitle:', modalTitle, 'isEditMode:', isEditMode);

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
            handleFileRemoval={handleFileRemoval}
            onCreateJobFromName={handleCreateJobFromNameWithClose}
            onRecruiterInfoChange={updateRecruiterDetails}
            isEditMode={isEditMode}
            onSearchFilterUpdate={updateSearchFilterRecord}
          />
        </ArxJDModalLayout>
      )}
    </ArxJDUploadDropzone>
  );
};
