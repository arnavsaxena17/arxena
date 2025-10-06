import axios from 'axios';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { gql, useMutation } from '@apollo/client';

import { uploadedJDState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { companyInfoType, createOneCandidateField, graphQLToUpdateOneWorkspaceMemberProfile, isDefined } from 'twenty-shared';
import { RecruiterDetails } from '../components/JobDetailsForm';
import { ParsedJD } from '../types/ParsedJD';
import { blankParsedJD, createDefaultParsedJD } from '../utils/createDefaultParsedJD';



export const useArxJDUpload = (objectNameSingular: string) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [parsedJD, setParsedJD] = useState<ParsedJD>(blankParsedJD);
  const [isUploading, setIsUploading] = useState(false);
  const [recruiterDetails, storeRecruiterDetails] = useState<RecruiterDetails | null>(null);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const { enqueueSnackBar } = useSnackBar();
  const { triggerJobsRefetch } = useJobRefetch();

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

  // Local copies of mutations to avoid build-order export issues
  const CREATE_ONE_SEARCH_FILTER = `mutation CreateOneSearchFilter($input: SearchFilterCreateInput!) {\n  createSearchFilter(data: $input) {\n    id\n    name\n    jobId\n    recruiterId\n    searchFilterName\n    searchFilterFields\n    searchFilterParameter\n    createdAt\n    updatedAt\n  }\n}`;

  const UPDATE_ONE_SEARCH_FILTER = `mutation UpdateOneSearchFilter($idToUpdate: ID!, $input: SearchFilterUpdateInput!) {\n  updateSearchFilter(id: $idToUpdate, data: $input) {\n    id\n    name\n    jobId\n    recruiterId\n    searchFilterName\n    searchFilterFields\n    searchFilterParameter\n    updatedAt\n  }\n}`;

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
        // If we're in edit mode and have a parsedJD, just attach the file to the existing job
        if (objectNameSingular === 'job' && parsedJD?.id) {
          await uploadAttachmentFile(file, {
            targetObjectNameSingular: CoreObjectNameSingular.Job,
            id: parsedJD.id,
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
          recruiterId: recruiterDetails?.workspaceMemberId
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
        console.log('recruiterDetails in useArxJDUpload::', recruiterDetails);
        console.log('recruiterDetails?.workspaceMemberId in useArxJDUpload::', recruiterDetails?.workspaceMemberId);
        // Set chatFlowOrder after job creation
        try {
          await updateOneRecord({
            idToUpdate: createdJob.id,
            updateOneRecordInput: {
              chatFlowOrder: ['startChat'],
              jobCode: jobCode,
              recruiterId: recruiterDetails?.workspaceMemberId || currentWorkspaceMember?.id
            },
          });
        } catch (chatFlowError) {
          console.error("Couldn't set chatFlowOrder", chatFlowError);
          // Continue with process even if setting chatFlowOrder fails
        }

        // Send job to Arxena after creation
        if (isDefined(createdJob?.name) && isDefined(createdJob?.id)) {
          // try {
          //   await sendCreateJobToArxena(
          //     createdJob.name,
          //     createdJob.id,
          //     tokenPair?.accessToken?.token || '',
          //     (errorMessage) => setError(errorMessage),
          //   );
          // } catch (arxenaError) {
          //   console.error("Couldn't send job to arxena", arxenaError);
          // }
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
            parsedJobDescription,
            filePath,
            searchParameters,
            ...updateData
          } = parsedData;

          setParsedJD(parsedData);

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

          // Generate search parameters using the already parsed job description
          try {
            // First, get the full ParsedJobDescription from the backend
            const parsedJobDescriptionResponse = await axios({
              method: 'post',
              url: `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/parse-job-description`,
              data: {
                jobDescription: data?.description || '',
                jobTitle: data?.name || '',
                company: data?.companyName || '',
                location: data?.jobLocation || '',
                industry: data?.companyName || '',
                filePath: attachmentAbsoluteURL, // Pass the file path for parsing
              },
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
              },
            });

            const parsedJobDescription = parsedJobDescriptionResponse.data;
            console.log('ParsedJobDescription from backend:', parsedJobDescription);

            // Update the parsedJD with the full ParsedJobDescription
            setParsedJD(prev => ({
              ...prev,
              parsedJobDescription: parsedJobDescription,
            }));

            const searchParamsResponse = await axios({
              method: 'post',
              url: `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/generate-search-parameters`,
              data: {
                parsedJobDescription: parsedJobDescription,
                searchType: 'classic',
                searchCategory: 'people',
              },
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
              },
            });

            if (searchParamsResponse.data) {
              // Store the generated search parameters for later use
              const searchParams = {
                generatedSearchParameters: searchParamsResponse.data,
              };

              // Create a SearchFilter linked to this job and recruiter, seeded with generated parameters
              let createdSearchFilterId: string | null = null;
              try {
                const createSearchFilterResponse = await axios({
                  method: 'post',
                  url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
                  data: {
                    query: CREATE_ONE_SEARCH_FILTER,
                    variables: {
                      input: {
                        name: 'search filter',
                        jobId: createdJob.id,
                        recruiterId: recruiterDetails?.workspaceMemberId || currentWorkspaceMember?.id,
                        searchFilterName: 'classic_people',
                        searchFilterParameter: {
                          generatedSearchParameters: searchParamsResponse.data,
                          resolvedSearchParameters: null, // Will be updated after resolution
                        },
                        position: 'first',
                      },
                    },
                  },
                  headers: {
                    Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                  },
                });
                createdSearchFilterId = createSearchFilterResponse?.data?.data?.createSearchFilter?.id || null;
                console.log('Created SearchFilter with generated parameters:', {
                  id: createdSearchFilterId,
                  generatedParams: searchParamsResponse.data
                });
              } catch (sfCreateError) {
                console.error('Failed to create SearchFilter:', sfCreateError);
              }
              
              // Resolve parameters to LinkedIn IDs
              try {
                console.log('Resolving generated parameters to LinkedIn IDs...');
                const resolveResponse = await axios({
                  method: 'post',
                  url: `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/resolve-parameters`,
                  data: {
                    searchParameters: searchParamsResponse.data.classicPeopleSearch,
                    searchType: 'classic',
                    searchCategory: 'people',
                  },
                  headers: {
                    Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                  },
                });

                if (resolveResponse.data) {
                  // Update search parameters with resolved IDs
                  const resolvedSearchParams = {
                    ...searchParams,
                    resolvedSearchParameters: {
                      classicPeopleSearch: resolveResponse.data,
                    },
                  };

                  // If we created a SearchFilter, update it now with both generated and resolved parameters
                  if (createdSearchFilterId) {
                    try {
                      await axios({
                        method: 'post',
                        url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
                        data: {
                          query: UPDATE_ONE_SEARCH_FILTER,
                          variables: {
                            idToUpdate: createdSearchFilterId,
                            input: {
                              searchFilterParameter: {
                                generatedSearchParameters: searchParamsResponse.data,
                                resolvedSearchParameters: {
                                  classicPeopleSearch: resolveResponse.data,
                                },
                              },
                            },
                          },
                        },
                        headers: {
                          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                        },
                      });
                      console.log('Updated SearchFilter with both generated and resolved parameters:', {
                        id: createdSearchFilterId,
                        generatedParams: searchParamsResponse.data,
                        resolvedParams: resolveResponse.data
                      });
                    } catch (sfUpdateError) {
                      console.error('Failed to update SearchFilter with resolved params:', sfUpdateError);
                    }
                  }
                  
                  setParsedJD(prev => ({
                    ...prev,
                    parsedJobDescription: {
                      jobTitle: data?.name || '',
                      company: data?.companyName || '',
                      location: data?.jobLocation || '',
                      industry: data?.companyName || '',
                      requiredSkills: [],
                      preferredSkills: [],
                      experienceLevel: 'mid_level',
                      education: [],
                      keywords: data?.specificCriteria ? data.specificCriteria.split(',').map((k: string) => k.trim()) : [],
                      responsibilities: [],
                      qualifications: [],
                      benefits: [],
                      employmentType: 'full_time',
                      remoteWork: false,
                      salaryRange: null,
                    },
                    filePath: attachmentAbsoluteURL,
                    searchParameters: [resolvedSearchParams],
                  }));

                  console.log('Parameters resolved successfully:', resolveResponse.data);
                }
              } catch (resolveError) {
                console.error('Failed to resolve parameters:', resolveError);
                // Still store the original parameters even if resolution fails
                setParsedJD(prev => ({
                  ...prev,
                  parsedJobDescription: {
                    jobTitle: data?.name || '',
                    company: data?.companyName || '',
                    location: data?.jobLocation || '',
                    industry: data?.companyName || '',
                    requiredSkills: [],
                    preferredSkills: [],
                    experienceLevel: 'mid_level',
                    education: [],
                    keywords: data?.specificCriteria ? data.specificCriteria.split(',').map((k: string) => k.trim()) : [],
                    responsibilities: [],
                    qualifications: [],
                    benefits: [],
                    employmentType: 'full_time',
                    remoteWork: false,
                    salaryRange: null,
                  },
                  filePath: attachmentAbsoluteURL,
                  searchParameters: [searchParams],
                }));
              }

              console.log('Search parameters generated successfully:', searchParams);
            }
          } catch (searchParamsError) {
            console.error('Failed to generate search parameters:', searchParamsError);
            // Continue with the process even if search parameters generation fails
          }

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
      updateCompanyWithDetails,
      parsedJD
    ],
  );


  const handleCreateJob = async () => {
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
        const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, parsedJobDescription, filePath, searchParameters, ...jobData } = parsedJD;
        
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
            const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, ...jobData } = parsedJD;
            createdJob = await createOneRecord({
              ...jobData,
              companyId: matchedCompany.id,
            });
            
            // Update company details if available
            if (parsedJD.companyDetails && parsedJD.companyDetails.trim() !== '') {
              await updateCompanyWithDetails(matchedCompany.id, parsedJD.companyDetails);
            }
          } else {
            // No company match found, create job without companyId
            const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, ...jobData } = parsedJD;
            createdJob = await createOneRecord({
              ...jobData,
            });
          }
        } else {
          // No company name, create job without companyId
          const { companyName, chatFlow, videoInterview, meetingScheduling, existingChatQuestions, ...jobData } = parsedJD;
          createdJob = await createOneRecord({
            ...jobData,
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

      // After successful job creation (not update), reload the page and navigate to job details
      if (isDefined(createdJob?.id) && !parsedJD.id) {
        // Trigger global job refetch to update Jobs component
        triggerJobsRefetch();
        
        // Use setTimeout to ensure the modal is closed before navigation
        setTimeout(() => {
          // Reload the page and navigate to job/{id}
          window.location.href = `/job/${createdJob.id}`;
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
              return axios({
                method: 'post',
                url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
                data: {
                  query: createOneCandidateField,
                  variables: {
                    input: {
                      name: question.trim(), // Ensure the question is trimmed before saving
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
