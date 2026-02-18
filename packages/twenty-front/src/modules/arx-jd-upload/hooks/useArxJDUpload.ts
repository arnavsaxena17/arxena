import axios from 'axios';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { gql, useMutation } from '@apollo/client';

import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import {
  companyInfoType, graphQLToUpdateOneWorkspaceMemberProfile, isDefined, LinkedInSearchCategory,
  LinkedInSearchType
} from 'twenty-shared';
import { RecruiterDetails } from '../components/JobDetailsForm';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
import { useApiKeysRecoil } from './useApiKeysRecoil';
import { useJobDescriptionParser } from './useJobDescriptionParser';
import { useSearchParameters } from './useSearchParameters';



export const useArxJDUpload = (objectNameSingular: string, modalMode?: 'create' | 'edit') => {
  const navigate = useNavigate();
  const [tokenPair] = useRecoilState(tokenPairState);
  const { keys: apiKeys, updateSpecificApiKey } = useApiKeysRecoil();
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  const [isUploading, setIsUploading] = useState(false);
  const [recruiterDetails, storeRecruiterDetails] = useState<RecruiterDetails | null>(null);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const { enqueueSnackBar } = useSnackBar();
  const { triggerJobsRefetch } = useJobRefetch();
  const { parseJobDescriptionFromDetails, parseJobDescriptionFromFile } = useJobDescriptionParser();
  const { generateResolvedSearchParameters } = useSearchParameters();

  const [error, setError] = useState<string | null>(null);
  const { createOneRecord } = useCreateOneRecord({ objectNameSingular });
  const { updateOneRecord } = useUpdateOneRecord({ objectNameSingular });
  const { destroyOneRecord } = useDestroyOneRecord({ objectNameSingular: 'attachment' });
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });
  const { records: attachments = [] } = useFindManyRecords({
    objectNameSingular: 'attachment',
    filter: parsedJD?.id && modalMode === 'edit' ? {
      jobId: { eq: parsedJD.id }
    } : undefined,
    skip: !parsedJD?.id || modalMode === 'create',
  });
  const { createOneRecord: createOneCompanyRecord } = useCreateOneRecord({ 
    objectNameSingular: 'company' 
  });
  const { updateOneRecord: updateOneCompanyRecord } = useUpdateOneRecord({ 
    objectNameSingular: 'company' 
  });
  const { createOneRecord: createOneSearchFilterRecord } = useCreateOneRecord({ 
    objectNameSingular: 'searchFilter' 
  });
  const { updateOneRecord: updateOneSearchFilterRecord } = useUpdateOneRecord({ 
    objectNameSingular: 'searchFilter' 
  });
  const { createOneRecord: createOneCandidateFieldRecord } = useCreateOneRecord({ 
    objectNameSingular: 'candidateField' 
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

    // Validate mandatory fields first
    if (!recruiterDetails.missingRecruiterInfo.phoneNumber?.trim() || !recruiterDetails.missingRecruiterInfo.jobTitle?.trim()) {
      enqueueSnackBar('Phone Number and Job Title are required fields', {
        variant: SnackBarVariant.Error,
      });
      return false;
    }

    // Validate remaining fields if they exist
    const emptyFields = Object.entries(recruiterDetails.missingRecruiterInfo)
      .filter(([key, value]) => key !== 'phoneNumber' && key !== 'jobTitle' && !value)
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
          const success = await updateSpecificApiKey(
            'whatsapp_web_phone_number',
            recruiterDetails.missingRecruiterInfo.phoneNumber
          );

          if (success) {
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
  }, [recruiterDetails, enqueueSnackBar, updateWorkspaceMemberProfile, updateSpecificApiKey]);

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

  // Function to remove existing attachments for a job
  const removeExistingAttachments = useCallback(async (jobId: string) => {
    try {
      // Use the existing attachments data
      const existingAttachments = attachments.filter(attachment => 
        attachment.jobId === jobId
      );

      // Delete all existing attachments
      for (const attachment of existingAttachments) {
        if (attachment.id) {
          await destroyOneRecord(attachment.id);
        }
      }
    } catch (error) {
      console.error('Error removing existing attachments:', error);
    }
  }, [destroyOneRecord, attachments]);

  // Function to handle file removal in edit mode
  const handleFileRemoval = useCallback(async () => {
    if (!parsedJD?.id) return;
    
    try {
      await removeExistingAttachments(parsedJD.id);
      
      // Clear the parsedJD fields but preserve the ID and essential properties
      const blankJD = {
        ...parsedJD,
        // Preserve ID and all chat flow configurations, videoInterview, and meetingScheduling settings
      };
      setParsedJD(blankJD);
      
      enqueueSnackBar('Job description file removed successfully', {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      console.error('Error removing file:', error);
      enqueueSnackBar('Failed to remove file', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD, removeExistingAttachments, setParsedJD, enqueueSnackBar]);

  const handleFileUpload = useCallback(
    async (acceptedFiles: File[]): Promise<void> => {
      if (acceptedFiles.length === 0) {
        return;
      }

      setError(null);
      setIsUploading(true);
      const file = acceptedFiles[0];

      try {
        // If we're in edit mode and have a parsedJD, remove existing attachments first, then upload new one
        if (objectNameSingular === 'job' && parsedJD?.id) {
          // Remove existing attachments
          await removeExistingAttachments(parsedJD.id);

          // Upload new attachment and update only the filePath in parsedJD
          const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
            targetObjectNameSingular: CoreObjectNameSingular.Job,
            id: parsedJD.id,
          });

          // Keep all existing parsedJD values, only update filePath
          setParsedJD((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              filePath: attachmentAbsoluteURL,
            };
          });

          console.log('parsedData in useArxJDUpload after setParsedJD::', parsedJD);
          enqueueSnackBar('Job description file updated successfully', {
            variant: SnackBarVariant.Success,
          });

          setIsUploading(false);
          return;
        }

        // Original code for creating a new job
        const baseJobCode = file.name.split('.')[0].replace(/ /g, '-').slice(0, 8);
        const jobCode = `${baseJobCode}-${Date.now().toString().slice(-4)}`;
        const createdJob = await createOneRecord({
          name: file.name.split('.')[0],
          jobCode: jobCode,
          chatFlowOrder: ['startChat'],
          isActive: true,
          recruiterId: recruiterDetails?.workspaceMemberId  || currentWorkspaceMember?.id
        });
        

        const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
          targetObjectNameSingular: CoreObjectNameSingular.Job,
          id: createdJob.id,
        });


        const uploadJDResponse = await axios({
          method: 'post',
          url: `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-jd`,
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

          // First, get the full ParsedJobDescription from the backend
          // Use file path if available (URL is supported), otherwise use details
          const parsedJobDescription = attachmentAbsoluteURL
            ? await parseJobDescriptionFromFile(attachmentAbsoluteURL)
            : await parseJobDescriptionFromDetails(
                data?.description || '',
                data?.name || '',
                data?.companyName || '',
                data?.jobLocation || '',
                data?.companyName || ''
              );
          console.log('ParsedJobDescription from backend:', parsedJobDescription);

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
            parsedJobDescription: parsedJobDescription,
            filePath: attachmentAbsoluteURL,
          });

          // Process company matching and update record with parsed data
          const {
            companyName,
            chatFlow,
            videoInterview,
            meetingScheduling,
            filePath,
            parsedJobDescription: _parsedJobDescription,
            searchFilters: _searchFilters,
            ...updateData
          } = parsedData;

          setParsedJD(parsedData);
          console.log('parsedData in useArxJDUpload after setParsedJD::', parsedData);

          // Update company details if we have a companyId and companyDetails
          if (companyId && parsedData.companyDetails && parsedData.companyDetails.trim() !== '') {
            try {
              await updateCompanyWithDetails(companyId, parsedData.description);
            } catch (companyUpdateError) {
              console.error("Couldn't update company details", companyUpdateError);
              // Continue with process even if updating company details fails
            }
          }

          const { companyId: _, ...restOfUpdateData } = updateData;
          const updateOneRecordInput = {
            ...restOfUpdateData,
            jobCode: jobCode,
            ...(companyId && companyId !== '' ? { companyId } : {}),
          };

          await updateOneRecord({
            idToUpdate: createdJob.id,
            updateOneRecordInput: updateOneRecordInput,
          });

          // Generate search plan using the new AI-driven endpoint

          const createPromptsResponse = await axios({
            method: 'post',
            url: `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/create-prompts`,
            data: {
              jobId: createdJob.id,
            },
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          });

          if (createPromptsResponse?.data?.status !== 'Success') {
            console.error('Failed to create prompts');
          }
        } else {
          throw new Error(uploadJDResponse?.data?.message || 'Failed to process JD');
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
      createOneSearchFilterRecord,
      setParsedJD,
      objectNameSingular,
      enqueueSnackBar,
      updateCompanyWithDetails,
      parsedJD,
      generateResolvedSearchParameters,
      parseJobDescriptionFromDetails,
      recruiterDetails?.workspaceMemberId,
      currentWorkspaceMember?.id
    ],
  );


  const handleCreateJob = useCallback(async () => {
    if (parsedJD === null) {
      return;
    }

    // Validate mandatory job fields first
    if (!parsedJD.name?.trim()) {
      enqueueSnackBar('Job Title is required', {
        variant: SnackBarVariant.Error,
      });
      return false;
    }

    if (!parsedJD.description?.trim()) {
      enqueueSnackBar('Short One Line Pitch is required', {
        variant: SnackBarVariant.Error,
      });
      return false;
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
      
      // If we're in edit mode (parsedJD.id exists), only update the existing job
      if (parsedJD.id) {
        const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, parsedJobDescription, filePath, searchFilters, searchParameters, ...jobData } = parsedJD;
        
        // If we have a company name, try to match it and update the companyId
        if (typeof parsedJD?.companyName === 'string' && parsedJD?.companyName !== '') {
          const matchedCompany = findBestCompanyMatch(parsedJD.companyName, '');
          if (matchedCompany !== null && typeof matchedCompany.id === 'string' && matchedCompany.id !== '') {
            createdJob = await updateOneRecord({
              idToUpdate: parsedJD.id,
              updateOneRecordInput: {
                ...jobData,
                companyId: matchedCompany.id,
              },
            });
            
            // Update company details if available
            if (parsedJD.companyDetails && parsedJD.companyDetails.trim() !== '') {
              await updateCompanyWithDetails(matchedCompany.id, parsedJD.companyDetails);
            }
          } else {
            // No company match found, just update the job without companyId
            createdJob = await updateOneRecord({
              idToUpdate: parsedJD.id,
              updateOneRecordInput: jobData,
            });
          }
        } else {
          // No company name, just update the job
          createdJob = await updateOneRecord({
            idToUpdate: parsedJD.id,
            updateOneRecordInput: jobData,
          });
        }
      } else {
        // Creating a new job
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
            const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, parsedJobDescription, filePath, searchFilters, searchParameters, ...jobData } = parsedJD;
            createdJob = await createOneRecord({
              ...jobData,
              isActive: true,
              companyId: matchedCompany.id,
            });
            
            // Update company details if available
            if (parsedJD.companyDetails && parsedJD.companyDetails.trim() !== '') {
              await updateCompanyWithDetails(matchedCompany.id, parsedJD.companyDetails);
            }
          } else {
            // No company match found, create job without companyId
            const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, parsedJobDescription, filePath, searchFilters, searchParameters, ...jobData } = parsedJD;
            createdJob = await createOneRecord({
              ...jobData,
              isActive: true,
            });
          }
        } else {
          // No company name, create job without companyId
          const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, parsedJobDescription, filePath, searchFilters, searchParameters, ...jobData } = parsedJD;
          createdJob = await createOneRecord({
            ...jobData,
            isActive: true,
          });
        }
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

      // After successful job creation (not update), navigate to job details
      if (isDefined(createdJob?.id) && !parsedJD.id) {
        // Trigger global job refetch to update Jobs component
        triggerJobsRefetch();
        
        // Use setTimeout to ensure the modal is closed before navigation
        setTimeout(() => {
          console.log('Navigating to job/{id}');
          navigate(`/job/${createdJob.id}`);
        }, 100);
      }

      if (parsedJD?.chatFlow?.questions && parsedJD?.chatFlow?.questions?.length > 0) {
        try {
          // Get the new questions by comparing with existingQuestions from ChatQuestionsSection
          // Use case-insensitive comparison and trim whitespace to avoid duplicates
          const newQuestions = parsedJD.chatFlow.questions.filter(
            (question: string) => !parsedJD.existingChatQuestions?.some(
              (existingQuestion: string) => 
                existingQuestion.trim().toLowerCase() === question.trim().toLowerCase()
            )
          );

          // Only create candidate fields for new questions
          const createCandidateFieldsPromises = newQuestions.map(
            async (question: string) => {
              return createOneCandidateFieldRecord({
                name: question.trim(), // Ensure the question is trimmed before saving
                jobsId: parsedJD.id,
                candidateFieldType: 'Text',
              });
            },
          );
          
          if (newQuestions.length > 0) {
            await Promise.all(createCandidateFieldsPromises);
          }
        } catch (error) {
          console.error('Error creating candidate fields:', error);
        }
      }

      return true;
    } catch (error) {
      console.log('Error creating job:', error);
      return false;
    }
  }, [
    parsedJD,
    enqueueSnackBar,
    recruiterDetails,
    updateRecruiterProfile,
    findBestCompanyMatch,
    createOneRecord,
    updateOneRecord,
    createOneCandidateFieldRecord,
    triggerJobsRefetch,
    tokenPair?.accessToken?.token,
  ]);

  // Reset all upload-related state
  const resetUploadState = useCallback(() => {
    // Force reset all state to initial values regardless of current state
    setError(null);
    setIsUploading(false);
    storeRecruiterDetails(null);
    setParsedJD(null); // Reset the parsed JD state
  }, [setParsedJD]);

  // Function to update search filter record with new search parameters
  const updateSearchFilterRecord = useCallback(async (
    searchFilters: {
      id: string;
      name: string;
      searchFilterParameter?: any;
      searchFilterName?: string;
      searchFilterFields?: any;
      chatHistory?: Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
      }>;
      enrichmentConfigs?: any[];
      columnFilters?: any[];
    }[],
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => {
    if (!searchFilters || searchFilters.length === 0) {
      console.error('No search filters provided for update');
      
      // Try to create a new search filter record if we have a job ID
      if (parsedJD?.id) {
        console.log('Attempting to create new SearchFilter record for job:', parsedJD.id);
        try {
          const searchFilterName = `${searchType}_${searchCategory}`;
          console.log('Creating SearchFilter with parameters:', {
            jobId: parsedJD.id,
            recruiterId: currentWorkspaceMember?.id,
            searchFilterName,
            generatedParams: generatedParameters,
            resolvedParams: resolvedParameters
          });
          
          const createdSearchFilter = await createOneSearchFilterRecord({
            name: 'search filter',
            jobId: parsedJD.id,
            recruiterId: currentWorkspaceMember?.id,
            searchFilterName,
            searchFilterParameter: {
              generatedSearchParameters: generatedParameters,
              resolvedSearchParameters: resolvedParameters,
            },
          });
          
          const newSearchFilterId = createdSearchFilter?.id;
          console.log('SearchFilter creation result:', {
            createdSearchFilter,
            newSearchFilterId,
            hasId: !!newSearchFilterId
          });
          
          if (newSearchFilterId) {
            console.log('Successfully created new SearchFilter record:', {
              id: newSearchFilterId,
              searchFilterName,
              generatedParams: generatedParameters,
              resolvedParams: resolvedParameters
            });
            
            // Update the parsedJD with the new searchFilterId
            setParsedJD(prev => {
              if (!prev) return null;
              
              console.log('Updated parsedJD with new SearchFilter:', {
                searchType,
                searchCategory,
                newSearchFilterId,
                note: 'Search parameters are now stored in searchFilters[].searchFilterParameter'
              });
              
              return {
                ...prev,
                searchFilters: [{
                  id: newSearchFilterId,
                  name: 'search filter',
                  searchFilterParameter: {
                    generatedSearchParameters: generatedParameters,
                    resolvedSearchParameters: resolvedParameters,
                  },
                  searchFilterName,
                  searchFilterFields: null,
                }]
              };
            });
            
            return;
          } else {
            console.error('SearchFilter was created but no ID was returned:', createdSearchFilter);
            enqueueSnackBar('SearchFilter was created but no ID was returned', {
              variant: SnackBarVariant.Error,
            });
          }
        } catch (createError) {
          console.error('Failed to create new SearchFilter record:', createError);
          enqueueSnackBar(`Failed to create search filter: ${createError instanceof Error ? createError.message : 'Unknown error'}`, {
            variant: SnackBarVariant.Error,
          });
        }
      } else {
        console.error('Cannot create SearchFilter record - no job ID available');
        enqueueSnackBar('Cannot create SearchFilter record - no job ID available', {
          variant: SnackBarVariant.Error,
        });
      }
      return;
    }
    
    // Use the first search filter for updating
    const searchFilterId = searchFilters[0].id;
    const searchFilterName = `${searchType}_${searchCategory}`;
    console.log('Updating SearchFilter record with merged parameters:', {
      id: searchFilterId,
      searchFilterName,
      generatedParams: generatedParameters,
      resolvedParams: resolvedParameters,
      note: 'These are the merged parameters (current + previous) being saved to database'
    });
    try {
      
      await updateOneSearchFilterRecord({
        idToUpdate: searchFilterId,
        updateOneRecordInput: {
          searchFilterName,
          searchFilterParameter: {
            generatedSearchParameters: generatedParameters,
            resolvedSearchParameters: resolvedParameters,
          },
        },
      });

      console.log('Successfully updated SearchFilter record with merged parameters:', {
        id: searchFilterId,
        searchFilterName,
        generatedParams: generatedParameters,
        resolvedParams: resolvedParameters,
        note: 'Merged parameters (current + previous) have been saved to database'
      });
      
      // Note: searchParameters are now stored in searchFilters[].searchFilterParameter
      console.log('Search parameters updated in searchFilters[].searchFilterParameter:', {
        searchType,
        searchCategory,
        generatedParameters,
        resolvedParameters,
        note: 'Search parameters are now stored in searchFilters[].searchFilterParameter'
      });
    } catch (error) {
      console.error('Failed to update SearchFilter record:', error);
      enqueueSnackBar(`Failed to update search filter: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
    }
  }, [updateOneSearchFilterRecord, createOneSearchFilterRecord, enqueueSnackBar, parsedJD?.id, currentWorkspaceMember?.id, setParsedJD]);

  // Function to create a job from just the name
  const handleCreateJobFromName = useCallback(async (jobName: string) => {
    if (!jobName || !jobName.trim()) {
      enqueueSnackBar('Job name is required', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Generate a job code from the name
      const baseJobCode = jobName.replace(/ /g, '-').slice(0, 8).toLowerCase();
      const jobCode = `${baseJobCode}-${Date.now().toString().slice(-4)}`;

      // Create the job with just the name, active status, and recruiter ID
      const createdJob = await createOneRecord({
        name: jobName.trim(),
        jobCode: jobCode,
        chatFlowOrder: ['startChat'],
        isActive: true,
        recruiterId: recruiterDetails?.workspaceMemberId || currentWorkspaceMember?.id,
      });

      if (!createdJob?.id) {
        throw new Error('Failed to create job');
      }

      // Trigger job refetch
      triggerJobsRefetch();

      enqueueSnackBar('Job created successfully', {
        variant: SnackBarVariant.Success,
      });

      // Navigate to the job page and close modal
      setTimeout(() => {
        navigate(`/job/${createdJob.id}`);
      }, 100);
    } catch (error: any) {
      console.error('Error creating job from name:', error);
      setError(error?.message || 'Failed to create job');
      enqueueSnackBar(`Failed to create job: ${error?.message || 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsUploading(false);
    }
  }, [
    createOneRecord,
    currentWorkspaceMember?.id,
    recruiterDetails?.workspaceMemberId,
    triggerJobsRefetch,
    navigate,
    enqueueSnackBar,
  ]);

  return {
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
    updateCompanyWithDetails,
    updateSearchFilterRecord,
    apiKeys,
  };
};
