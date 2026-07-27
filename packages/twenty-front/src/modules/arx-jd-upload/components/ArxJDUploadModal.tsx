import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { projectIdAtom } from '@/candidate-table/states/states';
import { useFindManyAttachments } from '@/candidate-search/hooks/useFindManyAttachments';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import { useEffect, useRef, useState } from 'react';
import { graphqlToFindManyProjects } from 'twenty-shared/graphql';
import { getAttachmentDownloadUrl } from 'twenty-shared/utils';

import { useSetParsedJDInternalState } from '../hooks/useParsedJDState';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { useArxJDUpload } from '../hooks/useArxJDUpload';
import { useProjectDescriptionParser } from '../hooks/useProjectDescriptionParser';
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
  const [isArxUploadJDModalOpen, setIsArxUploadJDModalOpen] = useAtomState(
    isArxUploadJDModalOpenState,
  );
  const [modalMode, setModalMode] = useAtomState(arxUploadJDModalModeState);
  const setParsedJDInternalState = useSetParsedJDInternalState();
  const [isLoadingExistingJob, setIsLoadingExistingJob] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentProjectId = useAtomStateValue(projectIdAtom);
  const [tokenPair] = useAtomState(tokenPairState);
  const { findManyAttachments } = useFindManyAttachments();
  const isEditMode = modalMode === 'edit';
  const projectIdToFetch =
    objectNameSingular === 'project' ? objectRecordId : currentProjectId;

  // Debug logging
  console.log('ArxJDUploadModal - modalMode:', modalMode, 'isEditMode:', isEditMode, 'projectIdToFetch:', projectIdToFetch);

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
    updateAssistantThreadRecord,
    apiKeys,
  } = useArxJDUpload(objectNameSingular, modalMode);

  const { reset: resetFormStepper } = useArxJDFormStepper(0);
  const { parseJobDescriptionFromFile } = useProjectDescriptionParser();

  // Track the previous open state to detect when the modal is first opened
  const prevOpenStateRef = useRef(false);
  // Track if we've done the stepper reset to avoid loops
  const didStepperResetRef = useRef(false);
  // Track if we've already fetched the job data
  const jobDataFetchedRef = useRef(false);

  // Workspace project records are on /graphql, not the default /metadata client
  const apolloCoreClient = useApolloCoreClient();
  const [executeJobQuery] = useLazyQuery(
    gql`
      ${graphqlToFindManyProjects}
    `,
    { client: apolloCoreClient },
  );

  // Function to fetch attachments for a job
  const fetchJobAttachments = async (projectId: string) => {
    try {
      const attachments = await findManyAttachments({
        filter: { targetProjectId: { eq: projectId } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
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
    if (!projectIdToFetch || !isEditMode || jobDataFetchedRef.current) return;

    try {
      setIsLoadingExistingJob(true);
      setLoadError(null);

      const { data: jobQueryData } = await executeJobQuery({
        variables: {
          filter: { id: { in: [projectIdToFetch] } },
          limit: 1,
        },
      });

      const data = jobQueryData as
        | {
            projects?: {
              edges?: Array<{ node?: Record<string, unknown> }>;
            };
          }
        | undefined;

      if (data?.projects?.edges?.[0]?.node) {
        const jobData = data.projects.edges[0].node as Record<string, any>;
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
        const attachmentDownloadUrl = getAttachmentDownloadUrl(attachment);
        if (attachmentDownloadUrl) {
          console.log('Found attachment:', attachmentDownloadUrl);

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

        // Get assistantThreadId for reference
        let assistantThreadId: string | undefined = undefined;
        try {
          console.log('Raw jobData.assistantThread:', jobData?.assistantThread);
          const assistantThreadEdges = jobData?.assistantThread?.edges || [];
          console.log('AssistantThread edges:', assistantThreadEdges);

          if (assistantThreadEdges.length > 0) {
            // Get the first assistant thread ID for reference
            assistantThreadId = assistantThreadEdges[0]?.node?.id;
            console.log('Found assistantThreadId:', assistantThreadId);
          }
        } catch (e) {
          console.warn('Failed to get assistantThreadId:', e);
        }

        // Create a parsed JD from the job data
        console.log('Creating parsedData with assistantThreadId:', assistantThreadId);
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
          filePath: attachmentDownloadUrl,
          parsedJobDescription: parsedJobDescription, // Use the fetched ParsedJobDescription
          assistantThreads: jobData.assistantThread?.edges?.map((edge: any) => ({
            id: edge.node.id,
            name: edge.node.name,
            assistantParameters: edge.node.assistantParameters,
            enrichmentConfigs: edge.node.enrichmentConfigs,
            columnFilters: edge.node.columnFilters,
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

        console.log('Final parsedData with assistantThreadId:', {
          assistantThreadId: parsedData.assistantThreads?.[0]?.id,
          id: parsedData.id,
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
      // In edit mode, fetch the job data (only if we have a valid projectIdToFetch)
      if (isEditMode && projectIdToFetch && projectIdToFetch.trim() !== '') {
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
  }, [isArxUploadJDModalOpen, resetUploadState, isEditMode, projectIdToFetch, fetchJobData, setParsedJD, setParsedJDInternalState]);

  // Separate effect to reset the form stepper only after the first render
  // This prevents circular dependencies with Jotai state updates
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
  const modalTitle = isEditMode ? "Edit Project Details" : "Upload Project Description";
  console.log('ArxJDUploadModal - modalTitle:', modalTitle, 'isEditMode:', isEditMode);

  return (
    <ArxJDUploadDropzone
      onDrop={async (acceptedFiles) => {
        await handleFileUpload(acceptedFiles);
      }}
    >
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
            handleFileUpload={async (files) => {
              await handleFileUpload(files);
            }}
            handleFileRemoval={handleFileRemoval}
            onCreateJobFromName={handleCreateJobFromNameWithClose}
            onRecruiterInfoChange={updateRecruiterDetails}
            isEditMode={isEditMode}
            onAssistantThreadUpdate={updateAssistantThreadRecord}
          />
        </ArxJDModalLayout>
      )}
    </ArxJDUploadDropzone>
  );
};
