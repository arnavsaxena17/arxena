import axios from 'axios';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';

import { useParsedJDState } from '@/arx-jd-upload/hooks/useParsedJDState';
import type { AssistantThread } from '@/assistant/types/assistant.types';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import type { companyInfoType } from 'twenty-shared/arx';
import { graphQLToUpdateOneWorkspaceMemberProfile } from 'twenty-shared/graphql';
import type { LinkedInSearchCategory, LinkedInSearchType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { RecruiterDetails } from '../components/ProjectDetailsForm';
import type { AssistantThreadSummary } from '../types/ParsedJD';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
import { syncChatQuestionsToDatabase } from '../utils/syncChatQuestions';
import { useApiKeysState } from './useApiKeysState';
import { useProjectDescriptionParser } from './useProjectDescriptionParser';
import { useSearchParameters } from './useSearchParameters';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

/** Compare domains ignoring trailing slashes, protocol, and leading www. */
const normalizeWebsiteUrlForMatch = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProtocol);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = (u.pathname || '/').replace(/\/+$/, '') || '';
    return path ? `${host}${path}` : host;
  } catch {
    return trimmed.toLowerCase().replace(/^www\./, '').replace(/\/+$/, '');
  }
};

/** GraphQL / Postgres reject `companyId: ""`; omit the field instead of clearing the relation incorrectly. */
const omitEmptyStringCompanyId = <T extends Record<string, unknown>>(payload: T): T => {
  const id = payload.companyId;
  const isEmpty =
    id === '' ||
    id === null ||
    (typeof id === 'string' && id.trim() === '');
  if (!isEmpty) {
    return payload;
  }
  const { companyId: _removed, ...rest } = payload;
  return rest as T;
};

export const useArxJDUpload = (objectNameSingular: string, modalMode?: 'create' | 'edit') => {
  const navigate = useNavigate();
  const tokenPair = useAtomStateValue(tokenPairState);
  const { keys: apiKeys, updateSpecificApiKey } = useApiKeysState();
  const [parsedJD, setParsedJD] = useParsedJDState();
  const [isUploading, setIsUploading] = useState(false);
  const [recruiterDetails, storeRecruiterDetails] = useState<RecruiterDetails | null>(null);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { triggerJobsRefetch } = useProjectRefetch();
  const { parseJobDescriptionFromDetails, parseJobDescriptionFromFile } = useProjectDescriptionParser();
  const { generateResolvedSearchParameters } = useSearchParameters();

  const [error, setError] = useState<string | null>(null);
  const { createOneRecord } = useCreateOneRecord({ objectNameSingular });
  const { updateOneRecord } = useUpdateOneRecord();
  const { destroyOneRecord } = useDestroyOneRecord({ objectNameSingular: 'attachment' });
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });
  const { records: attachments = [] } = useFindManyRecords({
    objectNameSingular: 'attachment',
    filter: parsedJD?.id && modalMode === 'edit' ? {
      targetProjectId: { eq: parsedJD.id },
    } : undefined,
    skip: !parsedJD?.id || modalMode === 'create',
  });
  const { createOneRecord: createOneCompanyRecord } = useCreateOneRecord({
    objectNameSingular: 'company'
  });
  const { updateOneRecord: updateOneCompanyRecord } = useUpdateOneRecord();


  const { createOneRecord: createOneAssistantThreadRecord } = useCreateOneRecord({
    objectNameSingular: 'assistantThread',
  });
  const { updateOneRecord: updateOneAssistantThreadRecord } = useUpdateOneRecord();

  const apolloCoreClient = useApolloCoreClient();
  const [updateWorkspaceMemberProfile] = useMutation(gql`
    ${graphQLToUpdateOneWorkspaceMemberProfile}
  `, { client: apolloCoreClient });

  // Function to update company record with companyDetails as descriptionOneliner
  const updateCompanyWithDetails = useCallback(async (companyId: string, companyDetails: string) => {
    if (!companyId || !companyDetails) {
      return;
    }
    try {
      await updateOneCompanyRecord({
        objectNameSingular: 'company',
        idToUpdate: companyId,
        updateOneRecordInput: {
          descriptionOneliner: companyDetails,
        },
      });
      enqueueSuccessSnackBar({ message: 'Company details updated successfully' });
    } catch (error) {
      console.error('Error updating company details:', error);
      enqueueErrorSnackBar({
        message: `Failed to update company details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [updateOneCompanyRecord, enqueueSuccessSnackBar, enqueueErrorSnackBar]);

  // Handler to update recruiter details from ProjectDetailsForm
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

    try {
      // Get workspaceMemberId from the recruiterDetails
      const workspaceMemberId = recruiterDetails.workspaceMemberId;

      if (!workspaceMemberId) {
        enqueueErrorSnackBar({ message: 'Unable to update recruiter profile: No recruiter ID found' });
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

      // Only validate and sync the WhatsApp number when the user actually provided one.
      if (recruiterDetails.missingRecruiterInfo.phoneNumber) {
        try {
          const success = await updateSpecificApiKey(
            'whatsapp_web_phone_number',
            recruiterDetails.missingRecruiterInfo.phoneNumber
          );

          if (success) {
            enqueueSuccessSnackBar({
              message: 'WhatsApp phone number updated successfully',
            });
          }
        } catch (error) {
          console.error('Error updating WhatsApp phone number:', error);
          enqueueErrorSnackBar({ message: 'Failed to update WhatsApp phone number' });
        }
      }

      enqueueSuccessSnackBar({ message: 'Recruiter profile updated successfully' });

      return true;
    } catch (error) {
      enqueueErrorSnackBar({
        message: `Failed to update recruiter profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return false;
    }
  }, [
    recruiterDetails,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    updateWorkspaceMemberProfile,
    updateSpecificApiKey,
  ]);

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

      // First try domain match (normalized: trailing slash, protocol, www)
      if (companyWebsiteUrl) {
        const needle = normalizeWebsiteUrlForMatch(companyWebsiteUrl);
        const domainMatch = companiesWithName.find(
          (company) =>
            needle !== '' &&
            normalizeWebsiteUrlForMatch(company.domainName.primaryLinkUrl) === needle,
        );
        if (domainMatch) {
          return {
            name: domainMatch?.name,
            companyId: domainMatch?.id,
            descriptionOneliner: domainMatch?.descriptionOneliner || '',
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
        };
      }
      return null;
    },
    [companies],
  );

  // Function to remove existing attachments for a job
  const removeExistingAttachments = useCallback(async (projectId: string) => {
    try {
      // Use the existing attachments data
      const existingAttachments = attachments.filter(
        (attachment) => attachment.targetProjectId === projectId,
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

      enqueueSuccessSnackBar({ message: 'Project description file removed successfully' });
    } catch (error) {
      console.error('Error removing file:', error);
      enqueueErrorSnackBar({ message: 'Failed to remove file' });
    }
  }, [
    parsedJD,
    removeExistingAttachments,
    setParsedJD,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
  ]);

  const handleFileUpload = useCallback(
    async (acceptedFiles: File[]): Promise<string | void> => {
      if (acceptedFiles.length === 0) {
        return;
      }

      setError(null);
      setIsUploading(true);
      const file = acceptedFiles[0];
      let createdProjectId: string | null = null;

      try {
        // If we're in edit mode and have a parsedJD, remove existing attachments first, then upload new one
        if (objectNameSingular === 'project' && parsedJD?.id) {
          // Remove existing attachments
          await removeExistingAttachments(parsedJD.id);

          // Upload new attachment and update only the filePath in parsedJD
          const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
            targetObjectNameSingular: 'project',
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

          enqueueSuccessSnackBar({
            message: 'Project description file updated successfully',
          });

          createdProjectId = parsedJD.id;
          return parsedJD.id;
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
        createdProjectId = createdJob.id;

        const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
          targetObjectNameSingular: 'project',
          id: createdJob.id,
        });


        const uploadJDResponse = await axios({
          method: 'post',
          url: `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-jd`,
          data: {
            projectId: createdJob.id,
            attachmentUrl: attachmentAbsoluteURL,
          },
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
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
                  enqueueSuccessSnackBar({ message: 'Created new company record' });
                }
              } catch (companyCreateError) {
                console.error("Couldn't create new company", companyCreateError);
                enqueueErrorSnackBar({
                  message: `Failed to create new company: ${companyCreateError instanceof Error ? companyCreateError.message : 'Unknown error'}`,
                });
                const existingAfterDuplicate = findBestCompanyMatch(
                  data.companyName,
                  data.companyWebsiteUrl,
                );
                if (existingAfterDuplicate?.companyId) {
                  companyId = existingAfterDuplicate.companyId;
                  enqueueSuccessSnackBar({ message: 'Linked job to existing company' });
                }
              }
            } else if (matchedCompany && matchedCompany.companyId) {
              companyId = matchedCompany.companyId;
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
            assistantThreads,
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
            objectNameSingular,
            idToUpdate: createdJob.id,
            updateOneRecordInput: updateOneRecordInput,
          });

          // Generate search plan using the new AI-driven endpoint

          const createPromptsResponse = await axios({
            method: 'post',
            url: `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/create-prompts`,
            data: {
              projectId: createdJob.id,
            },
            headers: {
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            },
          });

          if (createPromptsResponse?.data?.status !== 'Success') {
            console.error('Failed to create prompts');
          }
        } else {
          throw new Error(uploadJDResponse?.data?.message || 'Failed to process JD');
        }

        // Ensure any consumers (e.g. navigation drawer) immediately see the new job.
        triggerJobsRefetch();


        return createdJob.id;
      } catch (error: any) {
        console.error('Error processing JD:', error);
        setError(error?.message || 'Failed to process JD');

        // Even if later JD processing fails, return the created job id so that
        // the assistant thread can still attach to a valid job.
        if (createdProjectId) {
          return createdProjectId;
        }
      } finally {
        setIsUploading(false);
      }
    },
    [
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
      createOneRecord,
      updateOneRecord,
      uploadAttachmentFile,
      findBestCompanyMatch,
      createOneCompanyRecord,
      setParsedJD,
      objectNameSingular,
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
      updateCompanyWithDetails,
      parsedJD,
      generateResolvedSearchParameters,
      parseJobDescriptionFromDetails,
      recruiterDetails?.workspaceMemberId,
      currentWorkspaceMember?.id,
      triggerJobsRefetch,
    ],
  );


  const handleCreateJob = useCallback(async () => {
    if (parsedJD === null) {
      return;
    }

    // Validate mandatory job fields first
    if (!parsedJD.name?.trim()) {
      enqueueErrorSnackBar({ message: 'Job Title is required' });
      return false;
    }

    if (!parsedJD.description?.trim()) {
      enqueueErrorSnackBar({ message: 'Short One Line Pitch is required' });
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
        const {
          companyName,
          chatFlow,
          videoInterview,
          meetingScheduling,
          existingChatQuestions,
          chatQuestionFieldIds,
          parsedJobDescription,
          filePath,
          assistantThreads,
          searchParameters,
          ...jobData
        } = parsedJD;
        const jobPayloadBase = omitEmptyStringCompanyId(
          jobData as Record<string, unknown>,
        ) as typeof jobData;

        // If we have a company name, try to match it and update the companyId
        if (typeof parsedJD?.companyName === 'string' && parsedJD?.companyName !== '') {
          const matchedCompany = findBestCompanyMatch(parsedJD.companyName, '');
          if (matchedCompany !== null && typeof matchedCompany.companyId === 'string' && matchedCompany.companyId !== '') {
            createdJob = await updateOneRecord({
              objectNameSingular,
              idToUpdate: parsedJD.id,
              updateOneRecordInput: {
                ...jobPayloadBase,
                companyId: matchedCompany.companyId,
              },
            });

            // Update company details if available
            if (parsedJD.companyDetails && parsedJD.companyDetails.trim() !== '') {
              await updateCompanyWithDetails(matchedCompany.companyId, parsedJD.companyDetails);
            }
          } else {
            // No company match found, just update the job without companyId
            createdJob = await updateOneRecord({
              objectNameSingular,
              idToUpdate: parsedJD.id,
              updateOneRecordInput: jobPayloadBase,
            });
          }
        } else {
          // No company name, just update the job
          createdJob = await updateOneRecord({
            objectNameSingular,
            idToUpdate: parsedJD.id,
            updateOneRecordInput: jobPayloadBase,
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
            typeof matchedCompany.companyId === 'string' &&
            matchedCompany.companyId !== ''
          ) {
            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              existingChatQuestions,
              chatQuestionFieldIds,
              parsedJobDescription,
              filePath,
              assistantThreads,
              searchParameters,
              ...jobData
            } = parsedJD;
            const jobPayloadBase = omitEmptyStringCompanyId(
              jobData as Record<string, unknown>,
            ) as typeof jobData;
            createdJob = await createOneRecord({
              ...jobPayloadBase,
              isActive: true,
              companyId: matchedCompany.companyId,
            });

            // Update company details if available
            if (parsedJD.companyDetails && parsedJD.companyDetails.trim() !== '') {
              await updateCompanyWithDetails(matchedCompany.companyId, parsedJD.companyDetails);
            }
          } else {
            // No company match found, create job without companyId
            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              existingChatQuestions,
              chatQuestionFieldIds,
              parsedJobDescription,
              filePath,
              assistantThreads,
              searchParameters,
              ...jobData
            } = parsedJD;
            const jobPayloadBase = omitEmptyStringCompanyId(
              jobData as Record<string, unknown>,
            ) as typeof jobData;
            createdJob = await createOneRecord({
              ...jobPayloadBase,
              isActive: true,
            });
          }
        } else {
          // No company name, create job without companyId
          const {
            companyName,
            chatFlow,
            videoInterview,
            meetingScheduling,
            existingChatQuestions,
            chatQuestionFieldIds,
            parsedJobDescription,
            filePath,
            assistantThreads,
            searchParameters,
            ...jobData
          } = parsedJD;
          const jobPayloadBase = omitEmptyStringCompanyId(
            jobData as Record<string, unknown>,
          ) as typeof jobData;
          createdJob = await createOneRecord({
            ...jobPayloadBase,
            isActive: true,
          });
        }
      }


      // Send job to Arxena after creation
      // if (
      //   objectNameSingular === 'project' &&
      //   isDefined(parsedJD?.name) &&
      //   isDefined(parsedJD?.id)
      // ) {
      //   try {
      //     await sendProjectToArxena(
      //       parsedJD.name,
      //       parsedJD.id,
      //       tokenPair?.accessOrWorkspaceAgnosticToken?.token || '',
      //       (errorMessage) => setError(errorMessage),
      //     );
      //   } catch (error) {
      //     console.error("Couldn't send job to arxena", error);
      //   }
      // }

      // After successful job creation (not update), navigate to job details
      if (isDefined(createdJob?.id) && !parsedJD.id) {
        // Trigger global job refetch to update Projects component
        triggerJobsRefetch();

        // Use setTimeout to ensure the modal is closed before navigation
        setTimeout(() => {
          console.log('Navigating to project/{id}');
          navigate(`/project/${createdJob.id}`);
        }, 100);
      }

      const projectIdForChatQuestions = parsedJD.id ?? createdJob?.id;

      if (projectIdForChatQuestions && parsedJD.chatFlow?.questions?.length) {
        try {
          await syncChatQuestionsToDatabase({
            parsedJD,
            projectId: projectIdForChatQuestions,
            apiToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token,
          });
        } catch (error) {
          console.error('Error syncing chat questions:', error);
        }
      }

      return true;
    } catch (error) {
      console.log('Error creating job:', error);
      return false;
    }
  }, [
    parsedJD,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    recruiterDetails,
    updateRecruiterProfile,
    findBestCompanyMatch,
    createOneRecord,
    updateOneRecord,
    triggerJobsRefetch,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
  ]);

  // Reset all upload-related state
  const resetUploadState = useCallback(() => {
    // Force reset all state to initial values regardless of current state
    setError(null);
    setIsUploading(false);
    storeRecruiterDetails(null);
    setParsedJD(null); // Reset the parsed JD state
  }, [setParsedJD]);

  const toRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'object') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  };

  // Persist search plan state to assistant thread
  const updateAssistantThreadRecord = useCallback(async (
    assistantThread: AssistantThread,
    assistantThreads: AssistantThreadSummary[],
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: unknown,
    resolvedParameters: unknown,
  ) => {
    const assistantParameters = {
      generatedSearchParameters: toRecord(generatedParameters),
      resolvedSearchParameters: toRecord(resolvedParameters),
    };

    if (assistantThreads.length === 0) {
      if (!parsedJD?.id || !currentWorkspaceMember?.id) {
        enqueueErrorSnackBar({ message: 'Cannot create assistant thread - no job or recruiter' });
        return;
      }
      try {
        const displayName = `Search - ${searchType}_${searchCategory} - ${new Date().toISOString().slice(0, 10)}`;
        const newThread = await createOneAssistantThreadRecord({
          name: displayName,
          projectId: parsedJD.id,
          recruiterId: currentWorkspaceMember.id,
          assistantParameters,
          messages: [],
        });
        if (newThread?.id) {
          setParsedJD(prev =>
            prev
              ? {
                  ...prev,
                  assistantThreads: [
                    {
                      id: newThread.id,
                      name: displayName,
                      assistantParameters,
                      enrichmentConfigs: [],
                      columnFilters: [],
                    },
                    ...(prev.assistantThreads || []),
                  ],
                }
              : null,
          );
          return;
        }
      } catch (createError) {
        console.error('Failed to create assistant thread:', createError);
        enqueueErrorSnackBar({ message: `Failed to create thread: ${createError instanceof Error ? createError.message : 'Unknown error'}` });
      }
      return;
    }

    const assistantThreadId = assistantThread?.id ?? assistantThreads[0]?.id;
    if (!assistantThreadId) {
      enqueueErrorSnackBar({ message: 'Cannot update assistant thread - missing thread id' });
      return;
    }
    const displayName = `${searchType}_${searchCategory}`;
    try {
      await updateOneAssistantThreadRecord({
        objectNameSingular: 'assistantThread',
        idToUpdate: assistantThreadId,
        updateOneRecordInput: {
          name: displayName,
          assistantParameters,
        },
      });
    } catch (error) {
      console.error('Failed to update assistant thread:', error);
      enqueueErrorSnackBar({ message: `Failed to update thread: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  }, [
    createOneAssistantThreadRecord,
    updateOneAssistantThreadRecord,
    enqueueErrorSnackBar,
    parsedJD?.id,
    currentWorkspaceMember?.id,
    setParsedJD,
  ]);

  // Function to create a job from just the name
  const handleCreateJobFromName = useCallback(async (jobName: string) => {
    if (!jobName || !jobName.trim()) {
      enqueueErrorSnackBar({ message: 'Project name is required' });
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

      enqueueSuccessSnackBar({ message: 'Project created successfully' });

      // Navigate to the project page and close modal
      setTimeout(() => {
        navigate(`/project/${createdJob.id}`);
      }, 100);
    } catch (error: any) {
      console.error('Error creating job from name:', error);
      setError(error?.message || 'Failed to create job');
      enqueueErrorSnackBar({
        message: `Failed to create job: ${error?.message || 'Unknown error'}`,
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
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
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
    updateAssistantThreadRecord,
    apiKeys,
  };
};
