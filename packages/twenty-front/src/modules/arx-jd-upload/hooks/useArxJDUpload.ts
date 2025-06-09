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
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { gql, useMutation } from '@apollo/client';

import { uploadedJDState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { companyInfoType, createOneCandidateField, graphQLToUpdateOneWorkspaceMemberProfile, isDefined } from 'twenty-shared';
import { RecruiterDetails } from '../components/JobDetailsForm';
import { ParsedJD } from '../types/ParsedJD';
import { blankParsedJD, createDefaultParsedJD } from '../utils/createDefaultParsedJD';
import { sendCreateJobToArxena } from '../utils/sendCreateJobToArxena';



export const useArxJDUpload = (objectNameSingular: string) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [parsedJD, setParsedJD] = useState<ParsedJD>(blankParsedJD);
  const [isUploading, setIsUploading] = useState(false);
  const [recruiterDetails, storeRecruiterDetails] = useState<RecruiterDetails | null>(null);
  const { enqueueSnackBar } = useSnackBar();

  const [error, setError] = useState<string | null>(null);
  const { createOneRecord } = useCreateOneRecord({ objectNameSingular });
  const { updateOneRecord } = useUpdateOneRecord({ objectNameSingular });
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const [uploadedJD, setUploadedJD] = useRecoilState(uploadedJDState);
  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });
  const { createOneRecord: createOneCompanyRecord } = useCreateOneRecord({ 
    objectNameSingular: 'company' 
  });
  const { updateOneRecord: updateOneCompanyRecord } = useUpdateOneRecord({ 
    objectNameSingular: 'company' 
  });

  const [updateWorkspaceMemberProfile] = useMutation(gql`
    ${graphQLToUpdateOneWorkspaceMemberProfile}
  `);

  // Function to update company record with companyDetails as descriptionOneliner
  const updateCompanyWithDetails = useCallback(async (companyId: string, companyDetails: string) => {
    if (!companyId || !companyDetails) {
      return;
    }
    
    try {
      await updateOneCompanyRecord({
        idToUpdate: companyId,
        updateOneRecordInput: {
          descriptionOneliner: companyDetails,
        },
      });
      
      enqueueSnackBar('Company details updated successfully', {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      console.error('Error updating company details:', error);
      enqueueSnackBar(`Failed to update company details: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
    }
  }, [updateOneCompanyRecord, enqueueSnackBar]);

  // Handler to update recruiter details from JobDetailsForm
  const updateRecruiterDetails = useCallback((details: RecruiterDetails) => {
    // Only update the state if something actually changed
    const hasChanged = !recruiterDetails || 
      JSON.stringify(recruiterDetails.missingRecruiterInfo) !== JSON.stringify(details.missingRecruiterInfo) ||
      recruiterDetails.recruiterProfileId !== details.recruiterProfileId ||
      recruiterDetails.showRecruiterFields !== details.showRecruiterFields ||
      recruiterDetails.workspaceMemberId !== details.workspaceMemberId;
      
    if (hasChanged) {
      storeRecruiterDetails(details);
    }
  }, [recruiterDetails]);

  const updateRecruiterProfile = useCallback(async () => {
    if (!recruiterDetails || !recruiterDetails.recruiterProfileId || !recruiterDetails.showRecruiterFields) {
      return true; // No update needed, return success
    }

    // Validate that required fields are filled
    const emptyFields = Object.entries(recruiterDetails.missingRecruiterInfo)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyFields.length > 0) {
      enqueueSnackBar(`Please fill all the required recruiter fields: ${emptyFields.join(', ')}`, {
        variant: SnackBarVariant.Error,
      });
      return false;
    }

    try {
      // Get workspaceMemberId from the recruiterDetails
      const workspaceMemberId = recruiterDetails.workspaceMemberId;
      
      if (!workspaceMemberId) {
        enqueueSnackBar('Unable to update recruiter profile: No recruiter ID found', {
          variant: SnackBarVariant.Error,
        });
        return false;
      }
      
      const updateWorkspaceMemberProfileInput = {
        ...(recruiterDetails.missingRecruiterInfo.name && { name: recruiterDetails.missingRecruiterInfo.name }),
        ...(recruiterDetails.missingRecruiterInfo.phoneNumber && { phoneNumber: recruiterDetails.missingRecruiterInfo.phoneNumber }),
        ...(recruiterDetails.missingRecruiterInfo.companyDescription && { companyDescription: recruiterDetails.missingRecruiterInfo.companyDescription }),
        ...(recruiterDetails.missingRecruiterInfo.jobTitle && { jobTitle: recruiterDetails.missingRecruiterInfo.jobTitle }),
        workspaceMemberId,
      };
      
      // Update the workspace member profile
      await updateWorkspaceMemberProfile({
        variables: {
          idToUpdate: recruiterDetails.recruiterProfileId,
          input: {
            ...updateWorkspaceMemberProfileInput,
          },
        },
      });

      // If phone number is provided, update the whatsapp_web_phone_number in workspace modifications
      if (recruiterDetails.missingRecruiterInfo.phoneNumber) {
        try {
          const response = await axios({
            method: 'post',
            url: `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/api-keys`,
            data: {
              whatsapp_web_phone_number: recruiterDetails.missingRecruiterInfo.phoneNumber
            },
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          });

          if (response.status === 200) {
            enqueueSnackBar('WhatsApp phone number updated successfully', {
              variant: SnackBarVariant.Success,
            });
          }
        } catch (error) {
          console.error('Error updating WhatsApp phone number:', error);
          enqueueSnackBar('Failed to update WhatsApp phone number', {
            variant: SnackBarVariant.Error,
          });
        }
      }

      enqueueSnackBar('Recruiter profile updated successfully', {
        variant: SnackBarVariant.Success,
      });
      
      return true;
    } catch (error) {
      enqueueSnackBar(`Failed to update recruiter profile: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
      return false;
    }
  }, [recruiterDetails, enqueueSnackBar, updateWorkspaceMemberProfile, tokenPair?.accessToken?.token]);

  const findBestCompanyMatch = useCallback(
    (companyName: string, companyWebsiteUrl?: string): companyInfoType | null => {
      if (!Array.isArray(companies) || companies.length === 0) {
        return null;
      }

      const companiesWithName = companies.filter(
        (company): company is (ObjectRecord & { name: string; domainName: { primaryLinkUrl: string } }) =>
          typeof company === 'object' &&
          company !== null &&
          'name' in company &&
          typeof company.name === 'string' &&
          'domainName' in company &&
          typeof company.domainName === 'object' &&
          'primaryLinkUrl' in company.domainName &&
          typeof company.domainName.primaryLinkUrl === 'string',
      );

      if (companiesWithName.length === 0) {
        return null;
      }

      // First try exact domain match
      if (companyWebsiteUrl) {
        const domainMatch = companiesWithName.find(
          company => company.domainName.primaryLinkUrl === companyWebsiteUrl
        );
        if (domainMatch) {
          return {
            name: domainMatch?.name,
            companyId: domainMatch?.id,
            descriptionOneliner: domainMatch?.descriptionOneliner || '',
            id: domainMatch?.id,
            domainName: { primaryLinkUrl: domainMatch?.domainName?.primaryLinkUrl }
          };
        }
      }

      // Fallback to fuzzy name matching
      const fuse = new Fuse(companiesWithName, {
        keys: ['name'],
        threshold: 0.4,
      });

      const result = fuse.search(companyName);
      if (result.length > 0) {
        const matchedCompany = result[0].item;
        return {
          name: matchedCompany.name,
          companyId: matchedCompany.id,
          descriptionOneliner: matchedCompany.descriptionOneliner || '',
          id: matchedCompany.id,
          domainName: { primaryLinkUrl: matchedCompany.domainName.primaryLinkUrl }
        };
      }
      return null;
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
        // Ensure we're creating a job record, not a candidate record
        if (objectNameSingular !== 'job') {
          throw new Error('Cannot upload JD for non-job object');
        }
        
        const createdJob = await createOneRecord({
          name: file.name.split('.')[0],
          jobCode: jobCode,
          // Remove chatFlowOrder as it's causing issues - we'll set it later
        });
        
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

        // Set chatFlowOrder after job creation
        try {
          await updateOneRecord({
            idToUpdate: createdJob.id,
            updateOneRecordInput: {
              chatFlowOrder: ['startChat'],
              jobCode: jobCode

            },
          });
        } catch (chatFlowError) {
          console.error("Couldn't set chatFlowOrder", chatFlowError);
          // Continue with process even if setting chatFlowOrder fails
        }

        // Send job to Arxena after creation
        if (
          objectNameSingular === 'job' &&
          isDefined(createdJob?.name) &&
          isDefined(createdJob?.id)
        ) {
          try {
            await sendCreateJobToArxena(
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

        const uploadJDResponse = await axios({
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

        if (uploadJDResponse.data.success === true) {
          const data = uploadJDResponse.data.data;
          
          let matchedCompany = null;
          let companyId = '';
          
          if (data?.companyName) {
            matchedCompany = findBestCompanyMatch(data.companyName, data.companyWebsiteUrl);
            
            if (!matchedCompany && data.companyName.trim() !== '') {
              try {
                const newCompany = await createOneCompanyRecord({
                  name: data?.companyName,
                  ...(data?.companyDetails ? { descriptionOneliner: data?.companyDetails } : {}),
                  ...(data?.companyWebsiteUrl ? { domainName: { primaryLinkUrl: data?.companyWebsiteUrl } } : {}),
                });
                
                if (newCompany && newCompany.id) {
                  companyId = newCompany.id;
                  enqueueSnackBar('Created new company record', {
                    variant: SnackBarVariant.Success,
                  });
                }
              } catch (companyCreateError) {
                console.error("Couldn't create new company", companyCreateError);
                enqueueSnackBar(`Failed to create new company: ${companyCreateError instanceof Error ? companyCreateError.message : 'Unknown error'}`, {
                  variant: SnackBarVariant.Error,
                });
              }
            } else if (matchedCompany && matchedCompany.id) {
              companyId = matchedCompany.id;
            }
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
            companyId: companyId,
            companyDetails: data?.companyDetails || '',
            id: createdJob.id,
          });

          // Process company matching and update record with parsed data
          const {
            companyName,
            chatFlow,
            videoInterview,
            meetingScheduling,
            ...updateData
          } = parsedData;

          setParsedJD(parsedData);

          // Update company details if we have a companyId and companyDetails
          if (companyId && parsedData.companyDetails && parsedData.companyDetails.trim() !== '') {
            try {
              await updateCompanyWithDetails(companyId, parsedData.companyDetails);
            } catch (companyUpdateError) {
              console.error("Couldn't update company details", companyUpdateError);
              // Continue with process even if updating company details fails
            }
          }

          const { companyId: _, ...restOfUpdateData } = updateData;
          console.log("restOfUpdateData", restOfUpdateData);
          const updateOneRecordInput = {
            ...restOfUpdateData,
            jobCode: jobCode,
            ...(companyId && companyId !== '' ? { companyId } : {}),
          };
          

          console.log("updateOneRecordInput", updateOneRecordInput);

          await updateOneRecord({
            idToUpdate: createdJob.id,
            updateOneRecordInput: updateOneRecordInput,
          });

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

          if (createPromptsResponse.data.status !== 'Success') {
            console.error('Failed to create prompts');
          }

        } else {
          throw new Error(uploadJDResponse.data.message || 'Failed to process JD');
        }
      } catch (error: any) {
        console.error('Error processing JD:', error);
        setError(error?.message || 'Failed to process JD');
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
      createOneCompanyRecord,
      setParsedJD,
      objectNameSingular,
      setUploadedJD,
      enqueueSnackBar,
      updateCompanyWithDetails
    ],
  );


  const handleCreateJob = async () => {
    if (parsedJD === null) {
      return;
    }

    try {
      // First, update the recruiter profile if needed
      if (recruiterDetails?.showRecruiterFields) {
        try {
          await updateRecruiterProfile();
        } catch (error) {
          console.error('Error updating recruiter profile:', error);
        }
      }
      let createdJob: ObjectRecord & { id?: string; name?: string } | undefined;
      if (
        typeof parsedJD?.companyName === 'string' &&
        parsedJD?.companyName !== ''
      ) {
        const matchedCompany = findBestCompanyMatch(parsedJD.companyName, '');
        if (
          matchedCompany !== null &&
          typeof matchedCompany.id === 'string' &&
          matchedCompany.id !== '' 
        ) {
          const { companyName, ...jobData } = parsedJD;
          if (jobData.id) {
            createdJob = await updateOneRecord({
              idToUpdate: jobData.id,
              updateOneRecordInput: {
                companyId: matchedCompany.id,
              },
            });
          } else {
            createdJob = await createOneRecord({
              ...jobData,
              companyId: matchedCompany.id,
            });
          }
          
          // Update company details if available
          if (parsedJD.companyDetails && parsedJD.companyDetails.trim() !== '') {
            await updateCompanyWithDetails(matchedCompany.id, parsedJD.companyDetails);
          }
        }
      } else {
        createdJob = await createOneRecord({
          ...parsedJD,
        });
      }

      if ((parsedJD?.name !== uploadedJD?.jobName || 
           parsedJD?.jobCode !== uploadedJD?.jobCode || 
           parsedJD?.description !== uploadedJD?.jobDescription || 
           parsedJD?.jobLocation !== uploadedJD?.jobLocation || 
           parsedJD?.salaryBracket !== uploadedJD?.jobSalary) && 
           isDefined(parsedJD?.id)) {
        updateOneRecord({
          idToUpdate: parsedJD?.id || '',
          updateOneRecordInput: {
            name: parsedJD?.name,
            jobCode: parsedJD?.jobCode,
            description: parsedJD?.description,
            jobLocation: parsedJD?.jobLocation,
            salaryBracket: parsedJD?.salaryBracket,
          },
        });
      }

      // Send job to Arxena after creation
      // if (
      //   objectNameSingular === 'job' &&
      //   isDefined(parsedJD?.name) &&
      //   isDefined(parsedJD?.id)
      // ) {
      //   try {
      //     await sendJobToArxena(
      //       parsedJD.name,
      //       parsedJD.id,
      //       tokenPair?.accessToken?.token || '',
      //       (errorMessage) => setError(errorMessage),
      //     );
      //   } catch (error) {
      //     console.error("Couldn't send job to arxena", error);
      //   }
      // }

      // After successful job creation and when it's the last step, reload the page and navigate to job details
      if (isDefined(createdJob?.id)) {
        // Use setTimeout to ensure the modal is closed before navigation
        setTimeout(() => {
          // Reload the page and navigate to job/{id}
          window.location.href = `/job/${createdJob.id}`;
        }, 100);
      }

      if (parsedJD?.chatFlow?.questions && parsedJD?.chatFlow?.questions?.length > 0) {
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
          
          await Promise.all(createCandidateFieldsPromises);
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
    setError(null);
    setIsUploading(false);
    storeRecruiterDetails(null);
  }, []);

  return {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleCreateJob,
    resetUploadState,
    updateRecruiterDetails,
    updateCompanyWithDetails,
  };
};
