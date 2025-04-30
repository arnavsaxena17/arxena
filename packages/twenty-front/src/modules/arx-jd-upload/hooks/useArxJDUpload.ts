import axios from 'axios';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';

import { uploadedJDState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { createOneCandidateField, isDefined } from 'twenty-shared';
import { ParsedJD } from '../types/ParsedJD';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
import { sendJobToArxena } from '../utils/sendJobToArxena';



export const useArxJDUpload = (objectNameSingular: string) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const { createOneRecord } = useCreateOneRecord({ objectNameSingular });
  console.log('objectNameSingular for createOneRecord::', objectNameSingular);
  const { updateOneRecord } = useUpdateOneRecord({ objectNameSingular });
  console.log('objectNameSingular for updateOneRecord::', objectNameSingular);
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const [uploadedJD, setUploadedJD] = useRecoilState(uploadedJDState);
  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });


  // debugger;
  // const { reset: resetFormStepper } = useArxJDFormStepper();

  type Company = ObjectRecord & {
    name: string;
  };

  // async function createPrompts(apiToken: string) {
  //   for (const prompt of prompts) {
  //     const createResponse = await this.axiosRequest(
  //       JSON.stringify({
  //         variables: {
  //           input: {
  //             name: prompt.name,
  //             prompt: prompt.prompt,
  //             position: 'first',
  //           },
  //         },
  //         query: graphqlToCreateOnePrompt,
  //       }),
  //       apiToken,
  //     );

  //     console.log(`\${prompt.name} created successfully`, createResponse.data);
  //   }
  // }

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

      setError(null);
      setIsUploading(true);
      const file = acceptedFiles[0];

      try {
        const jobCode = file.name.split('.')[0].replace(/ /g, '-').slice(0, 10);
        console.log('jobCode::', jobCode);
        console.log('creating new job in name:::', file.name.split('.')[0]);
        const createdJob = await createOneRecord({
          name: file.name.split('.')[0],
          jobCode: jobCode,
          chatFlowOrder: ['startChat'],
        });
        console.log('createdJob::', createdJob);
        setUploadedJD({
          jobCode: jobCode,
          jobName: file.name.split('.')[0],
          jobDescription: '',
          jobLocation: '',
          jobSalary: '',
        });
        if (createdJob?.id === undefined || createdJob?.id === null) {
          throw new Error('Failed to create job record');
        }

        // Send job to Arxena after creation
        if (
          objectNameSingular === 'job' &&
          isDefined(createdJob?.name) &&
          isDefined(createdJob?.id)
        ) {
          try {
            await sendJobToArxena(
              createdJob.name,
              createdJob.id,
              tokenPair?.accessToken?.token || '',
              (errorMessage) => setError(errorMessage),
            );
          } catch (arxenaError) {
            console.error("Couldn't send job to arxena", arxenaError);
          }
        }

        const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
          targetObjectNameSingular: CoreObjectNameSingular.Job,
          id: createdJob.id,
        });

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

        if (response.data.success === true) {
          const data = response.data.data;
          
          // Try to match company if a name was provided
          let matchedCompany = null;
          if (data?.companyName) {
            matchedCompany = findBestCompanyMatch(data.companyName);
          }

          const parsedData = createDefaultParsedJD({
            name: data?.name || '',
            description: data?.description || '',
            jobCode: data?.jobCode || '',
            jobLocation: data?.jobLocation || '',
            salaryBracket: data?.salaryBracket || '',
            isActive: true,
            specificCriteria: data?.specificCriteria || '',
            pathPosition: data?.pathPosition || '',
            companyName: data?.companyName || '',
            companyId: matchedCompany?.id || '',
            companyDetails: data?.companyDetails || '',
            id: createdJob.id,
          });
          console.log('parsedData::', parsedData);

          // Process company matching and update record with parsed data
          const {
            companyName,
            chatFlow,
            videoInterview,
            meetingScheduling,
            ...updateData
          } = parsedData;

          setParsedJD(parsedData);

          console.log('parsedData.companyName::', parsedData.companyName);
          // Try to match company if a name was provided
          if (
            typeof parsedData.companyName === 'string' &&
            parsedData.companyName !== ''
          ) {
            const matchedCompany = findBestCompanyMatch(parsedData.companyName);
            if (
              isDefined(matchedCompany) &&
              matchedCompany !== null &&
              matchedCompany.id !== undefined &&
              typeof matchedCompany.id === 'string' &&
              matchedCompany.id !== ''
            ) {
              updateData.companyId = matchedCompany.id;
            }
          }
          console.log('updateData::', updateData);

          console.log('createdJob.id::', createdJob.id);
          console.log('updateData::', updateData);

          const { companyId, ...restOfUpdateData } = updateData;
          const updateOneRecordInput = {
            ...restOfUpdateData,
            ...(companyId && companyId !== '' ? { companyId } : {}),
          };

          console.log('updateOneRecordInput::', updateOneRecordInput);
          // Update the job record with the processed data
          await updateOneRecord({
            idToUpdate: createdJob.id,
            updateOneRecordInput: updateOneRecordInput,
          });

          console.log('createdJob.id::', createdJob.id);

          const createPromptsResponse = await axios({
            method: 'post',
            url: `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/create-prompts`,
            data: {
              jobId: createdJob.id,
            },
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          });

          if (createPromptsResponse.data.status === 'Success') {
            console.log('Prompts created successfully');
          } else {
            console.error('Failed to create prompts');
          }

          console.log('parsedJD uqestion::::', parsedJD?.chatFlow);
          console.log('parsedJD uqestion::::', parsedJD?.chatFlow?.questions);
          // Create candidate fields for each question in the chat flow

        } else {
          throw new Error(response.data.message || 'Failed to process JD');
        }

        console.log('parsedJD uqestion::::', parsedJD?.chatFlow);
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
      objectNameSingular,
    ],
  );


  const handleCreateJob = async () => {
    console.log('handleCreateJob');
    console.log('parsedJD::', parsedJD);
    if (parsedJD === null) {
      console.log('parsedJD is null in handleCreateJob');
      return;
    }

    try {
      let createdJob: ObjectRecord & { id?: string; name?: string } | undefined;
      console.log('parsedJD.companyName::', parsedJD.companyName);
      console.log('uploadedJD::', uploadedJD);
      // debugger;
      if (
        typeof parsedJD.companyName === 'string' &&
        parsedJD.companyName !== ''
      ) {
        console.log('parsedJD.companyName is not empty in handleCreateJob');
        const matchedCompany = findBestCompanyMatch(parsedJD.companyName);
        if (
          matchedCompany !== null &&
          typeof matchedCompany.id === 'string' &&
          matchedCompany.id !== ''
        ) {
          console.log('matchedCompany::', matchedCompany);
          const { companyName, ...jobData } = parsedJD;
          createdJob = await createOneRecord({
            ...jobData,
            companyId: matchedCompany.id,
          });
        }
        else {
          console.log('matchedCompany is null in handleCreateJob');
        }


      } else {
        console.log('parsedJD hence creating new record in database in handleCreateJob::', parsedJD);
        createdJob = await createOneRecord({
          ...parsedJD,
        });
      }

      if ((parsedJD?.name !== uploadedJD?.jobName || parsedJD?.jobCode !== uploadedJD?.jobCode || parsedJD?.description !== uploadedJD?.jobDescription || parsedJD?.jobLocation !== uploadedJD?.jobLocation || parsedJD?.salaryBracket !== uploadedJD?.jobSalary) && isDefined(parsedJD.id)) {
        updateOneRecord({
          idToUpdate: parsedJD.id,
          updateOneRecordInput: {
            name: parsedJD.name,
            jobCode: parsedJD.jobCode,
            description: parsedJD.description,
            jobLocation: parsedJD.jobLocation,
            salaryBracket: parsedJD.salaryBracket,
          },
        });
      }






      // Send job to Arxena after creation
      if (
        objectNameSingular === 'job' &&
        isDefined(parsedJD?.name) &&
        isDefined(parsedJD?.id)
      ) {
        try {
          console.log('sending job to arxena in handleCreateJob::');
          console.log('parsedJD.name::', parsedJD.name);
          console.log('parsedJD.id::', parsedJD.id);
          await sendJobToArxena(
            parsedJD.name,
            parsedJD.id,
            tokenPair?.accessToken?.token || '',
            (errorMessage) => setError(errorMessage),
          );
        } catch (error) {
          console.error("Couldn't send job to arxena", error);
        }
      }
      console.log('parsedJD.chatFlow.questions::', parsedJD.chatFlow.questions);
      console.log('parsedJD.chatFlow.questions::createdJob', createdJob);

      // After successful job creation and when it's the last step, reload the page and navigate to job details
      if (isDefined(createdJob?.id)) {
        // Use setTimeout to ensure the modal is closed before navigation
        setTimeout(() => {
          // Reload the page and navigate to job/{id}
          window.location.href = `/job/${createdJob.id}`;
        }, 100);
      }

      

      console.log('parsedJD.chatFlow.questions::', parsedJD.chatFlow.questions);
      if (parsedJD?.chatFlow?.questions && parsedJD.chatFlow.questions.length > 0) {
        console.log('parsedJD.chatFlow.questions::', parsedJD.chatFlow.questions);
        try {
          const createCandidateFieldsPromises = parsedJD.chatFlow.questions.map(
            async (question: string, index: number) => {
              return axios({
                method: 'post',
                url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
                data: {
                  query: createOneCandidateField,
                  variables: {
                    input: {
                      name: question,
                      jobsId: parsedJD.id,
                      candidateFieldType: 'Text',
                    },
                  },
                },
                headers: {
                  Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                },
              });
            },
          );
          

          const candidateFieldsResponses = await Promise.all(createCandidateFieldsPromises);
          console.log('Candidate fields created successfully', candidateFieldsResponses);
        } catch (error) {
          console.error('Error creating candidate fields:', error);
        }
      }



      return true;
    } catch (error) {
      console.error('Error creating job:', error);
      return false;
    }
  };

  // Reset all upload-related state
  const resetUploadState = useCallback(() => {
    // Force reset all state to initial values regardless of current state
    // These are local useState hooks so they won't trigger any Recoil circular updates
    setParsedJD(null);
    setError(null);
    setIsUploading(false);
  }, []);

  return {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleCreateJob,
    resetUploadState,
  };
};
