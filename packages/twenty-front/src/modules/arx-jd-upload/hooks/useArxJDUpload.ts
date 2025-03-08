import { gql, useApolloClient } from '@apollo/client';
import axios from 'axios';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';

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

  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });

  // const { reset: resetFormStepper } = useArxJDFormStepper();

  type Company = ObjectRecord & {
    name: string;
  };

  const findBestCompanyMatch = useCallback(
    (companyName: string): Company | null => {
      if (!Array.isArray(companies) || companies.length === 0) {
        return null;
      }

      const companiesWithName = companies.filter(
        (company): company is Company =>
          typeof company === 'object' &&
          company !== null &&
          'name' in company &&
          typeof company.name === 'string',
      );

      if (companiesWithName.length === 0) {
        return null;
      }

      const fuse = new Fuse(companiesWithName, {
        keys: ['name'],
        threshold: 0.4,
      });

      const result = fuse.search(companyName);
      return result.length > 0 ? result[0].item : null;
    },
    [companies],
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

      try {
        const createdJob = await createOneRecord({
          name: file.name.split('.')[0],
        });

        console.log('Created job record:', createdJob);

        if (createdJob?.id === undefined || createdJob?.id === null) {
          throw new Error('Failed to create job record');
        }

        const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
          targetObjectNameSingular: CoreObjectNameSingular.Job,
          id: createdJob.id,
        });

        console.log('Uploaded attachment file:', attachmentAbsoluteURL);

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
          const data = response.data.data;
          const parsedData = createDefaultParsedJD({
            name: data.name,
            description: data.description,
            jobCode: data.jobCode,
            jobLocation: data.jobLocation,
            salaryBracket: data.salaryBracket,
            isActive: true,
            specificCriteria: data.specificCriteria,
            pathPosition: data.pathPosition,
            companyName: data.companyName,
            companyId: data.companyId,
          });

          console.log('Parsed JD data created successfully:', parsedData);

          if (
            typeof parsedData.companyName === 'string' &&
            parsedData.companyName !== ''
          ) {
            const matchedCompany = findBestCompanyMatch(parsedData.companyName);
            if (
              typeof matchedCompany?.id === 'string' &&
              matchedCompany.id !== ''
            ) {
              const {
                companyName,
                chatFlow,
                videoInterview,
                meetingScheduling,
                ...updateData
              } = parsedData;
              updateData.companyId = matchedCompany.id;
              console.log(
                'Setting parsedJD state with company match:',
                parsedData,
              );
              setParsedJD(parsedData);

              await updateOneRecord({
                idToUpdate: createdJob.id,
                updateOneRecordInput: updateData,
              });
            }
          } else {
            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              ...updateData
            } = parsedData;
            console.log(
              'Setting parsedJD state without company match:',
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
      return;
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

      let createdJob;

      if (typeof companyName === 'string' && companyName !== '') {
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
        createdJob = await createOneRecord({
          ...validJobFields,
        });
      }

      // If job was created successfully, call handleFinish with the job ID
      if (isDefined(createdJob) && isDefined(createdJob.id)) {
        console.log(
          'Job created successfully, now calling handleFinish with ID:',
          createdJob.id,
        );

        // Transform parsedJD to match handleFinish parameter type
        const transformedParsedJD = {
          ...parsedJD,
          meetingScheduling: {
            meetingType: parsedJD.meetingScheduling?.meetingType || 'scheduled',
            availableDates:
              parsedJD.meetingScheduling?.availableDates.map(
                (date) => date.date,
              ) || [],
          },
        };

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
        if (parsedJD.chatFlow.order.startChat) {
          selectedChatFlows.push('startChat');
        }
        if (parsedJD.chatFlow.order.startVideoInterviewChat) {
          selectedChatFlows.push('startVideoInterviewChat');
        }
        if (parsedJD.chatFlow.order.startMeetingSchedulingChat) {
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
          parsedJD.videoInterview.questions.length > 0 &&
          parsedJD.chatFlow.order.startVideoInterviewChat
        ) {
          // First, fetch the job to get its associated video interview template
          console.log('Fetching job with ID:', jobId);
          const findJobQuery = `
            query FindOneJob($objectRecordId: ID!) {
              job(filter: {id: {eq: $objectRecordId}}) {
                id
                videoInterviewTemplate {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          `;

          const jobResponse = await apolloClient.query({
            query: gql`
              ${findJobQuery}
            `,
            variables: {
              objectRecordId: jobId,
            },
          });

          // if (!jobResponse.data?.job?.videoInterviewTemplate?.edges?.length) {
          //   console.log('No video interview template found for job');
          //   console.log('Creating video interview template...');

          //   // Create a video interview template if it doesn't exist
          //   const createVideoInterviewTemplateMutation = `
          //     mutation CreateOneVideoInterviewTemplate($input: VideoInterviewTemplateCreateInput!) {
          //       createVideoInterviewTemplate(data: $input) {
          //         id
          //         name
          //         jobId
          //       }
          //     }
          //   `;

          //   const templateResponse = await apolloClient.mutate({
          //     mutation: gql`
          //       ${createVideoInterviewTemplateMutation}
          //     `,
          //     variables: {
          //       input: {
          //         name: `${parsedJD.name} Video Interview Template`,
          //         jobId: jobId,
          //         introduction:
          //           'Please answer the following questions for your video interview.',
          //         instructions:
          //           'You will have 2 minutes to answer each question.',
          //         position: 1,
          //         videoInterviewModelId: '1', // Use a default value or fetch available models if needed
          //       },
          //     },
          //   });

          //   const videoInterviewTemplateId =
          //     templateResponse.data?.createVideoInterviewTemplate?.id;

          //   // Create video interview questions
          //   console.log('Creating video interview questions...');
          //   const videoQuestionsToCreate =
          //     parsedJD.videoInterview.questions.map((question, index) => ({
          //       videoInterviewTemplateId: videoInterviewTemplateId,
          //       questionValue: question,
          //       name: question,
          //       timeLimit: 120, // Default time limit in seconds
          //       position: index + 1,
          //     }));

          //   await createManyVideoQuestions(videoQuestionsToCreate);
          //   console.log('Successfully created video interview questions');
          // } else {
          // Get the video interview template ID from the job
          const videoInterviewTemplateId =
            jobResponse.data.job.videoInterviewTemplate.edges[0].node.id;

          // Create video interview questions
          console.log('Creating video interview questions...');
          const videoQuestionsToCreate = parsedJD.videoInterview.questions.map(
            (question, index) => ({
              videoInterviewTemplateId: videoInterviewTemplateId,
              questionValue: question,
              name: question,
              timeLimit: 120, // Default time limit in seconds
              position: index + 1,
            }),
          );

          await createManyVideoQuestions(videoQuestionsToCreate);
          console.log('Successfully created video interview questions');
          // }
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
          const createInterviewScheduleMutation = `
          mutation CreateOneInterviewSchedule($input: InterviewScheduleCreateInput!) {
            createInterviewSchedule(data: $input) {
              __typename
              createdAt
              deletedAt
              id
              jobsId
              meetingType
              name
              position
              slotsAvailable
              updatedAt
            }
          }
        `;

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

          // Send GraphQL mutation using axios directly
          const response = await axios.request({
            method: 'post',
            url: process.env.REACT_APP_GRAPHQL_URL || '/graphql',
            headers: {
              authorization: 'Bearer ' + (tokenPair?.accessToken || ''),
              'content-type': 'application/json',
            },
            data: JSON.stringify({
              query: createInterviewScheduleMutation,
              variables: {
                input: interviewScheduleData,
              },
            }),
          });

          if (response.data.errors === true) {
            console.error(
              'Interview schedule creation failed:',
              response.data.errors,
            );
            throw new Error(
              'Failed to create interview schedule: ' +
                JSON.stringify(response.data.errors),
            );
          }
          console.log('Successfully created interview schedule');
        } else {
          console.log('No interview schedule to create');
        }

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
      tokenPair,
      updateOneRecord,
      apolloClient,
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
