import { gql, useApolloClient } from '@apollo/client';
import axios from 'axios';
// import fuzzy from 'fuzzy';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import {
  FindManyVideoInterviewModels,
  FindOneJob,
  isDefined,
} from 'twenty-shared';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';

import mongoose from 'mongoose';
import { ParsedJD } from '../types/ParsedJD';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
// import { useArxJDFormStepper } from './useArxJDFormStepper';

export const useArxJDUpload = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const apolloClient = useApolloClient();

  const { createOneRecord } = useCreateOneRecord({ objectNameSingular: 'job' });
  const { updateOneRecord } = useUpdateOneRecord({ objectNameSingular: 'job' });
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const { createManyRecords: createManyQuestions } = useCreateManyRecords({
    objectNameSingular: 'question',
  });
  const { createManyRecords: createManyVideoQuestions } = useCreateManyRecords({
    objectNameSingular: 'videoInterviewQuestion',
  });
  const { createOneRecord: createOneInterviewSchedule } = useCreateOneRecord({
    objectNameSingular: 'interviewSchedule',
  });

  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });

  // const { reset: resetFormStepper } = useArxJDFormStepper();

  type Company = ObjectRecord & {
    name: string;
  };

  const findBestCompanyMatch = useCallback(
    (companyName: string): Company | null => {
      console.log('Finding best company match...', companyName);
      if (!Array.isArray(companies) || companies.length === 0) {
        return null;
      }

      console.log('Companies:', companies);
      const companiesWithName = companies.filter(
        (company): company is Company =>
          typeof company === 'object' &&
          company !== null &&
          'name' in company &&
          typeof company.name === 'string',
      );

      console.log('Companies with name:', companiesWithName);

      if (companiesWithName.length === 0) {
        return null;
      }

      // const company = companiesWithName.find(
      //   (company) => company.name.toLowerCase() === companyName.toLowerCase(),
      // );

      // return company || null;

      const fuse = new Fuse(companiesWithName, {
        keys: ['name'],
        threshold: 0.4,
      });
      console.log('Fuse:', fuse);
      const result = fuse.search(companyName);

      console.log('Result:', result);

      return result.length > 0 ? result[0].item : null;
    },
    [companies],
  );

  const sendJobToArxena = useCallback(
    async (jobName: string, jobId: string) => {
      console.log('process.env.NODE_ENV', process.env.NODE_ENV);
      try {
        const arxenaJobId = new mongoose.Types.ObjectId().toString();

        console.log('This is the jobName', jobName);
        const response = await axios.post(
          process.env.NODE_ENV === 'production'
            ? 'https://app.arxena.com/candidate-sourcing/create-job-in-arxena-and-sheets'
            : 'http://localhost:3000/candidate-sourcing/create-job-in-arxena-and-sheets',
          { job_name: jobName, new_job_id: arxenaJobId, id_to_update: jobId },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.status !== 200 && response.status !== 201) {
          throw new Error(
            `Failed to create job on Arxena: ${response.statusText}`,
          );
        }
        return response.data;
      } catch (error) {
        console.error('Error sending job to Arxena:', error);
      }
    },
    [tokenPair?.accessToken?.token],
  );

  const handleFileUpload = useCallback(
    async (acceptedFiles: File[]): Promise<void> => {
      if (acceptedFiles.length === 0) {
        return;
      }

      console.log('Starting file upload...', acceptedFiles[0].name);
      setError(null);
      setIsUploading(true);
      const file = acceptedFiles[0];
      console.log('File:', file);
      try {
        const createdJob = await createOneRecord({
          name: file.name.split('.')[0],
        });

        console.log('Created job record:', createdJob);

        if (createdJob?.id === undefined || createdJob?.id === null) {
          throw new Error('Failed to create job record');
        }

        console.log('Uploading attachment file...');

        const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
          targetObjectNameSingular: CoreObjectNameSingular.Job,
          id: createdJob.id,
        });

        console.log('Uploaded attachment file:', attachmentAbsoluteURL);

        console.log('Uploading JD...');

        const response = await axios({
          method: 'post',
          url: `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/upload-jd`,
          data: {
            jobId: createdJob.id,
            attachmentUrl: attachmentAbsoluteURL,
          },
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
        });

        console.log('API response:', response.data);

        if (response.data.success === true) {
          console.log('JD uploaded successfully');
          const data = response.data.data;
          const parsedData = createDefaultParsedJD({
            name: data.name,
            description: data.description,
            jobCode: data.jobCode,
            jobLocation: data.jobLocation,
            salaryBracket: data.salaryBracket,
            isActive: true,
            specificCriteria: data.specificCriteria,
            // pathPosition: data.pathPosition,
            companyName: data.companyName,
            companyId: data.companyId,
            id: createdJob.id,
          });

          console.log('Parsed JD data created successfully:', parsedData);

          if (
            typeof parsedData.companyName === 'string' &&
            parsedData.companyName !== ''
          ) {
            console.log('Finding best company match...');
            const matchedCompany = findBestCompanyMatch(parsedData.companyName);

            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              ...updateData
            } = parsedData;

            if (
              matchedCompany !== null &&
              typeof matchedCompany.id === 'string' &&
              matchedCompany.id !== ''
            ) {
              updateData.companyId = matchedCompany.id;
              console.log(
                'Setting parsedJD state with company match:',
                parsedData,
              );
            } else {
              console.log(
                'Setting parsedJD state without company match (no match found):',
                parsedData,
              );
            }

            setParsedJD(parsedData);

            await updateOneRecord({
              idToUpdate: createdJob.id,
              updateOneRecordInput: updateData,
            });
          } else {
            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              ...updateData
            } = parsedData;
            console.log(
              'Setting parsedJD state without company match (no company name):',
              parsedData,
            );
            setParsedJD(parsedData);

            await updateOneRecord({
              idToUpdate: createdJob.id,
              updateOneRecordInput: updateData,
            });
          }
        } else {
          throw new Error(response.data.message || 'Failed to process JD');
        }
      } catch (error: any) {
        console.error('Error processing JD:', error);
        setError(error?.message || 'Failed to process JD');
        setParsedJD(null);
      } finally {
        setIsUploading(false);
      }
    },
    [
      tokenPair?.accessToken?.token,
      createOneRecord,
      updateOneRecord,
      uploadAttachmentFile,
      findBestCompanyMatch,
      setParsedJD,
    ],
  );

  const handleCreateJob = async () => {
    if (parsedJD === null) {
      return false;
    }

    console.log('parsedJD', parsedJD);
    try {
      // Filter out fields that are not part of the job schema
      const {
        companyName,
        chatFlow,
        videoInterview,
        meetingScheduling,
        ...validJobFields
      } = parsedJD;

      // Check if we already have a job ID from the initial file upload
      if (
        'id' in validJobFields &&
        typeof validJobFields.id === 'string' &&
        validJobFields.id !== ''
      ) {
        console.log('Using existing job ID:', validJobFields.id);

        // Update the existing job with any new information
        await updateOneRecord({
          idToUpdate: validJobFields.id,
          updateOneRecordInput: validJobFields,
        });

        console.log('Updated existing job:', validJobFields.id);

        // Transform parsedJD to match handleFinish parameter type
        const transformedParsedJD = {
          ...parsedJD,
          meetingScheduling: {
            meetingType: parsedJD.meetingScheduling?.meetingType || 'online',
            availableDates:
              parsedJD.meetingScheduling?.availableDates.map(
                (date) => date.date,
              ) || [],
          },
        };
        console.log('Transformed parsedJD:', transformedParsedJD);

        await handleFinish(validJobFields.id, transformedParsedJD);
        return true;
      }

      // If no existing job ID, create a new job (this is a fallback case)
      let createdJob;

      if (typeof companyName === 'string' && companyName !== '') {
        console.log('Finding best company match...');
        const matchedCompany = findBestCompanyMatch(companyName);
        if (
          matchedCompany !== null &&
          typeof matchedCompany.id === 'string' &&
          matchedCompany.id !== ''
        ) {
          createdJob = await createOneRecord({
            ...validJobFields,
            companyId: matchedCompany.id,
          });
        }
      } else {
        console.log('Creating job without company match...');
        createdJob = await createOneRecord({
          ...validJobFields,
        });
      }

      console.log('Created job:', createdJob);

      // If job was created successfully, call handleFinish with the job ID
      if (isDefined(createdJob) && isDefined(createdJob.id)) {
        console.log(
          'Job created successfully, now calling handleFinish with ID:',
          createdJob.id,
        );
        console.log('Parsed JD:', parsedJD);

        // Transform parsedJD to match handleFinish parameter type
        const transformedParsedJD = {
          ...parsedJD,
          meetingScheduling: {
            meetingType: parsedJD.meetingScheduling?.meetingType || 'online',
            availableDates:
              parsedJD.meetingScheduling?.availableDates.map(
                (date) => date.date,
              ) || [],
          },
        };
        console.log('Transformed parsedJD:', transformedParsedJD);

        await handleFinish(createdJob.id, transformedParsedJD);
      }

      return true;
    } catch (error) {
      console.error('Error creating job:', error);
      return false;
    }
  };

  const handleFinish = useCallback(
    async (
      jobId: string,
      parsedJD: {
        name: string;
        description: string;
        jobCode: string;
        jobLocation: string;
        salaryBracket: string;
        pathPosition: string;
        specificCriteria: string;
        isActive: boolean;
        chatFlow: {
          order: {
            [key: string]: boolean;
          };
          questions: string[];
        };
        videoInterview: {
          questions: string[];
        };
        meetingScheduling: {
          meetingType: string;
          availableDates: string[];
        };
      },
    ) => {
      console.log('Starting handleFinish for job:', {
        jobId,
        name: parsedJD.name,
      });

      try {
        setLoading(true);
        setError(null);

        // 1. Update job record with chatFlow array
        console.log(
          'Building chatFlow array from order:',
          parsedJD.chatFlow.order,
        );
        const selectedChatFlows = [];
        if (parsedJD.chatFlow.order.initialChat) {
          selectedChatFlows.push('startChat');
        }
        if (parsedJD.chatFlow.order.meetingScheduling) {
          selectedChatFlows.push('startVideoInterviewChat');
        }
        if (parsedJD.chatFlow.order.videoInterview) {
          selectedChatFlows.push('startMeetingSchedulingChat');
        }
        console.log('Selected chat flows:', selectedChatFlows);

        // Update the job record with the chatFlow array
        console.log('Updating job record with chat flows...');

        await updateOneRecord({
          idToUpdate: jobId,
          updateOneRecordInput: {
            // Store the chat flow data in a valid field
            // Using 'chatbotConfig' as it appears to be a valid field for job records
            chatFlowOrder: selectedChatFlows,
          },
        });
        console.log('Successfully updated job record with chat flows');

        // 2. Create questions from chatFlow.questions array
        if (
          parsedJD.chatFlow.questions &&
          parsedJD.chatFlow.questions.length > 0
        ) {
          console.log(
            'Creating chat flow questions:',
            parsedJD.chatFlow.questions.length,
            'questions found',
          );
          const questionsToCreate = parsedJD.chatFlow.questions.map(
            (question, index) => ({
              jobsId: jobId,
              name: question,
              // questionValue: question,
              position: index + 1,
            }),
          );

          await createManyQuestions(questionsToCreate);
          console.log('Successfully created chat flow questions');
        } else {
          console.log('No chat flow questions to create');
        }

        // 3. Create video interview questions
        if (
          parsedJD.videoInterview.questions &&
          parsedJD.videoInterview.questions.length > 0
        ) {
          // First, fetch the job to get its associated video interview template
          console.log('Fetching job with ID:', jobId);

          const jobResponse = await apolloClient.query({
            query: gql`
              ${FindOneJob}
            `,
            variables: {
              objectRecordId: jobId,
            },
          });

          if (!jobResponse.data?.job?.videoInterviewTemplate?.edges?.length) {
            console.log('No video interview template found for job');
            console.log('Creating video interview template...');

            // Create a video interview template if it doesn't exist
            // First, fetch available video interview models

            const modelsResponse = await apolloClient.query({
              query: gql`
                ${FindManyVideoInterviewModels}
              `,
              variables: {
                filter: {},
                orderBy: [{ position: 'AscNullsFirst' }],
              },
            });

            console.log('Video interview models:', modelsResponse.data);
            const videoInterviewModelId =
              modelsResponse.data?.videoInterviewModels?.edges?.[0]?.node?.id ||
              '1';
            console.log(
              'Using video interview model ID:',
              videoInterviewModelId,
            );

            const createVideoInterviewTemplateMutation = `
              mutation CreateOneVideoInterviewTemplate($input: VideoInterviewTemplateCreateInput!) {
                createVideoInterviewTemplate(data: $input) {
                  id
                  name
                  jobId
                  introduction
                  instructions
                  videoInterviewModelId
                }
              }
            `;

            const templateResponse = await apolloClient.mutate({
              mutation: gql`
                ${createVideoInterviewTemplateMutation}
              `,
              variables: {
                input: {
                  name: `${parsedJD.name} Interview Template`,
                  jobId: jobId,
                  introduction: `Hi, I am Arnav Saxena. I am a Director at Arxena, a US based recruitment firm. 
                  Thanks so much for your application for the role of a ${parsedJD.name}. 
                  We are excited to get to know you a little better!
                  So we have ${parsedJD.videoInterview.questions.length} questions in the steps ahead!
                  You'll need about 10 to 15 minutes and a strong signal to complete this.
                  When you click the I'm ready lets go button, you'll be taken to the first question, you'll have 4 minutes to record your answer. 
                  If this is your first time doing this interview this way, please don't stress about getting the perfect video. We are more interested in getting to know you and not getting the perfect video. 
                  So relax, take a breath and get started!`,
                  instructions: `Before you begin the interview:
                  1. Find a quiet place with good internet connectivity
                  2. Ensure you are in a well-lit area where your face is clearly visible
                  3. Dress professionally for the interview
                  4. Look directly at the camera while speaking
                  5. Speak clearly at a moderate pace
                  You will have 4 minutes to answer each question. Good luck!`,
                  videoInterviewModelId: videoInterviewModelId,
                },
              },
            });

            console.log('Template creation response:', templateResponse.data);
            const videoInterviewTemplateId =
              templateResponse.data?.createVideoInterviewTemplate?.id;

            // Create video interview questions
            console.log('Creating video interview questions...');
            const videoQuestionsToCreate =
              parsedJD.videoInterview.questions.map((question, index) => ({
                videoInterviewTemplateId: videoInterviewTemplateId,
                questionValue: question,
                name: question,
                timeLimit: 120, // Default time limit in seconds
                position: index + 1,
              }));

            await createManyVideoQuestions(videoQuestionsToCreate);
            console.log('Successfully created video interview questions');
          } else {
            // Get the video interview template ID from the job
            console.log('Job response:', jobResponse.data.job);
            const videoInterviewTemplateId =
              jobResponse.data.job.videoInterviewTemplate.edges[0].node.id;

            // Create video interview questions
            console.log(
              'Creating video interview questions...',
              parsedJD.videoInterview.questions,
            );
            const videoQuestionsToCreate =
              parsedJD.videoInterview.questions.map((question, index) => ({
                videoInterviewTemplateId: videoInterviewTemplateId,
                questionValue: question,
                name: question,
                timeLimit: 120,
              }));

            await createManyVideoQuestions(videoQuestionsToCreate);
            console.log('Successfully created video interview questions');
          }
        } else {
          console.log('No video interview questions to create');
        }

        // 4. Create interview schedule for meeting scheduling
        if (
          parsedJD.meetingScheduling?.meetingType !== undefined &&
          parsedJD.meetingScheduling?.meetingType !== ''
        ) {
          console.log(
            'Starting interview schedule creation with type:',
            parsedJD.meetingScheduling.meetingType,
          );

          const interviewScheduleData = {
            jobsId: jobId,
            name: `${parsedJD.name} Interview Schedule`,
            position: 1,
            meetingType: parsedJD.meetingScheduling.meetingType,
            slotsAvailable: parsedJD.meetingScheduling.availableDates,
          };
          console.log(
            'Creating interview schedule with data:',
            interviewScheduleData,
          );
          try {
            const createdInterviewSchedule = await createOneInterviewSchedule(
              interviewScheduleData,
            );
            if (!createdInterviewSchedule) {
              console.error(
                'Interview schedule creation failed: No response data',
              );
              throw new Error(
                'Failed to create interview schedule: No response data',
              );
            }
            console.log(
              'Interview schedule created successfully:',
              createdInterviewSchedule,
            );
          } catch (error) {
            console.error('Interview schedule creation failed:', error);
            throw new Error(
              'Failed to create interview schedule: ' +
                (error instanceof Error ? error.message : String(error)),
            );
          }
        } else {
          console.log('No interview schedule to create');
        }
        console.log('Sending job to Arxena...');
        await sendJobToArxena(parsedJD.name, jobId);
        console.log('Job sent to Arxena successfully');

        console.log('handleFinish completed successfully');
        setLoading(false);
      } catch (err) {
        console.error('handleFinish failed with error:', err);
        setLoading(false);
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while processing the job data',
        );
        console.error('Error in handleFinish:', err);
      }
    },
    [
      createManyQuestions,
      createManyVideoQuestions,
      updateOneRecord,
      sendJobToArxena,
      apolloClient,
      createOneInterviewSchedule,
    ],
  );

  // Reset all upload-related state
  const resetUploadState = useCallback(() => {
    // Only reset parsedJD if there was an error, otherwise keep it
    if (error !== null) {
      setParsedJD(null);
    }
    setError(null);
    setIsUploading(false);
  }, [error]);

  return {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleCreateJob,
    resetUploadState,
    handleFinish,
    loading,
  };
};
