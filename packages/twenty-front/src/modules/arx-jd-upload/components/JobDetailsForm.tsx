import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { viewableRecordIdState } from '@/object-record/record-right-drawer/states/viewableRecordIdState';
import { viewableRecordNameSingularState } from '@/object-record/record-right-drawer/states/viewableRecordNameSingularState';
import { SingleRecordSelectMenuItemsWithSearch } from '@/object-record/relation-picker/components/SingleRecordSelectMenuItemsWithSearch';
import { useAddNewRecordAndOpenRightDrawer } from '@/object-record/relation-picker/hooks/useAddNewRecordAndOpenRightDrawer';
import { RecordForSelect } from '@/object-record/relation-picker/types/RecordForSelect';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { gql, useLazyQuery, useMutation } from '@apollo/client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { graphQLToCreateOneWorkspaceMemberProfile, graphqlToFindManyJobs, isDefined } from 'twenty-shared';
import { IconEye } from 'twenty-ui';
import { v4 } from 'uuid';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledFieldGroup,
  StyledFullWidthField,
  StyledInput,
  StyledLabel,
  StyledSection,
  StyledSectionContent
} from './ArxJDUploadModal.styled';

export type RecruiterProfileInfo = {
  name?: string;
  phoneNumber?: string;
  companyDescription?: string;
  jobTitle?: string;
};

export interface RecruiterDetails {
  missingRecruiterInfo: RecruiterProfileInfo;
  recruiterProfileId?: string;
  showRecruiterFields: boolean;
  workspaceMemberId?: string;
}

// Create mutation for updating workspaceMemberProfile

export const JobDetailsForm: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
  onRecruiterInfoChange,
}) => {
  const [missingRecruiterInfo, setMissingRecruiterInfo] = useState<RecruiterProfileInfo>({});
  const [showRecruiterFields, setShowRecruiterFields] = useState(false);
  const [recruiterProfile, setRecruiterProfile] = useState<any>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent keyboard event from propagating to global handlers
    e.stopPropagation();
  };

  console.log('missingRecruiterInfo::', missingRecruiterInfo);

  const setViewableRecordId = useSetRecoilState(viewableRecordIdState);
  const setViewableRecordNameSingular = useSetRecoilState(viewableRecordNameSingularState);
  const { openRightDrawer } = useRightDrawer();
  const { createOneRecord } = useCreateOneRecord({
    objectNameSingular: 'company',
  });

  const { objectMetadataItem: companyObjectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: 'company',
  });

  const { createNewRecordAndOpenRightDrawer } = useAddNewRecordAndOpenRightDrawer({
    relationObjectMetadataNameSingular: 'company',
    relationObjectMetadataItem: companyObjectMetadataItem,
    recordId: parsedJD.id || '',
  });

  const [executeQuery, { error, data }] = useLazyQuery(gql`
    ${graphqlToFindManyJobs}
  `);

  const [updateWorkspaceMemberProfile] = useMutation(gql`
    ${graphQLToCreateOneWorkspaceMemberProfile}
  `);
  console.log('recruiterProfile::', recruiterProfile);

  // Memoize workspaceMemberId to prevent unnecessary re-renders
  const workspaceMemberId = useMemo(() => {
    return data?.jobs?.edges?.[0]?.node?.recruiterId;
  }, [data?.jobs?.edges]);

  // Create a memoized recruiter details object to avoid unnecessary re-renders
  const recruiterDetails = useMemo(() => {
    if (!onRecruiterInfoChange) return null;
    
    return {
      missingRecruiterInfo,
      recruiterProfileId: recruiterProfile?.id,
      showRecruiterFields,
      workspaceMemberId,
    };
  }, [missingRecruiterInfo, recruiterProfile?.id, showRecruiterFields, workspaceMemberId, onRecruiterInfoChange]);

  // Update parent component with recruiter details when they change
  useEffect(() => {
    if (onRecruiterInfoChange && recruiterDetails) {
      onRecruiterInfoChange(recruiterDetails);
    }
  }, [onRecruiterInfoChange, recruiterDetails]);

  const getJobDetails = useCallback(async () => {
    try {
      if (parsedJD.id) {
        const { data } = await executeQuery({
          variables: {
            filter: { id: { in: [parsedJD.id] } },
            limit: 1,
          },
        });

        console.log('data::', data);

        // Check if recruiter profile data exists
        const recruiterProfile = data?.jobs?.edges?.[0]?.node?.recruiter?.workspaceMemberProfile?.edges?.[0]?.node;
        console.log('recruiterProfile::', recruiterProfile);
        setRecruiterProfile(recruiterProfile);

        // Check for missing recruiter profile fields
        const missingFields: RecruiterProfileInfo = {};
        
        if (!recruiterProfile?.name) {
          missingFields.name = '';
        }
        
        if (!recruiterProfile?.phoneNumber) {
          missingFields.phoneNumber = '';
        }
        
        if (!recruiterProfile?.companyDescription) {
          missingFields.companyDescription = '';
        }
        
        if (!recruiterProfile?.jobTitle) {
          missingFields.jobTitle = '';
        }

        // If any fields are missing, show the recruiter profile form
        if (Object.keys(missingFields).length > 0) {
          setMissingRecruiterInfo(missingFields);
          setShowRecruiterFields(true);
        } else {
          setShowRecruiterFields(false);
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
    }
  }, [executeQuery, parsedJD.id]);

  // Check job details when the component mounts or when job ID changes
  useEffect(() => {
    if (parsedJD.id) {
      getJobDetails();
    }
  }, [parsedJD.id, getJobDetails]);

  const handleCompanySelect = (company?: RecordForSelect) => {
    if (company) {
      setParsedJD({
        ...parsedJD,
        companyId: company.id,
        companyName: company.name,
      });
    } else {
      setParsedJD({
        ...parsedJD,
        companyId: '',
        companyName: '',
      });
    }
  };

  const updateRecruiterInfoField = (field: keyof RecruiterProfileInfo, value: string) => {
    console.log('updateRecruiterInfoField::', field, value);
    setMissingRecruiterInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateCompany = async (searchInput?: string) => {
    try {
      if (createNewRecordAndOpenRightDrawer) {
        await createNewRecordAndOpenRightDrawer(searchInput);
      } else {
        const newRecordId = v4();
        const createRecordPayload = {
          id: newRecordId,
          name: searchInput ?? '',
        };
        await createOneRecord(createRecordPayload);
        setViewableRecordId(newRecordId);
        setViewableRecordNameSingular('company');
        openRightDrawer(RightDrawerPages.ViewRecord, {
          title: 'View Company',
          Icon: IconEye,
        });
      }
    } catch (error) {
      console.error('Error creating company:', error);
    }
  };

  const updateRecruiterProfile = async () => {
    console.log('updateRecruiterProfile::', recruiterProfile);
    if (!recruiterProfile?.id) {
      enqueueSnackBar('Unable to update recruiter profile: No profile ID found', {
        variant: SnackBarVariant.Error,
      });
      return false;
    }

    // Validate that required fields are filled
    const emptyFields = Object.entries(missingRecruiterInfo)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyFields.length > 0) {
      enqueueSnackBar(`Please fill all the required recruiter fields: ${emptyFields.join(', ')}`, {
        variant: SnackBarVariant.Error,
      });
      return false;
    }

    try {
      console.log('updateRecruiterProfile::', recruiterProfile);
      console.log('missingRecruiterInfo::', missingRecruiterInfo);
      setIsUpdatingProfile(true);

      // Update the workspace member profile
      await updateWorkspaceMemberProfile({
        variables: {
          input: {
            id: recruiterProfile.id,
            ...(missingRecruiterInfo.name && { name: missingRecruiterInfo.name }),
            ...(missingRecruiterInfo.phoneNumber && { phoneNumber: missingRecruiterInfo.phoneNumber }),
            ...(missingRecruiterInfo.companyDescription && { companyDescription: missingRecruiterInfo.companyDescription }),
            ...(missingRecruiterInfo.jobTitle && { jobTitle: missingRecruiterInfo.jobTitle }),
            workspaceMemberId: workspaceMemberId,
          },
        },
      });

      enqueueSnackBar('Recruiter profile updated successfully', {
        variant: SnackBarVariant.Success,
      });

      // Refresh job details to verify the updates
      await getJobDetails();
      return true;
    } catch (error) {
      console.error('Error updating recruiter profile:', error);
      enqueueSnackBar(`Failed to update recruiter profile: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
      return false;
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <StyledSection>
      {/* <StyledSectionHeader>Job Details</StyledSectionHeader> */}
      <StyledSectionContent>
        <StyledFieldGroup>
          <StyledLabel>Job Title</StyledLabel>
          <StyledInput
            value={parsedJD.name}
            onChange={(e) => setParsedJD({ ...parsedJD, name: e.target.value })}
            placeholder="Enter job title"
            onKeyDown={handleKeyDown}
          />
        </StyledFieldGroup>

        <StyledFieldGroup>
          <StyledLabel>Company</StyledLabel>
          <SingleRecordSelectMenuItemsWithSearch
            objectNameSingular="company"
            selectedRecordIds={parsedJD.companyId ? [parsedJD.companyId] : []}
            onRecordSelected={handleCompanySelect}
            emptyLabel="No Company"
            onCreate={handleCreateCompany}
            isJobDetailsForm={true}
          />
        </StyledFieldGroup>

        {/* <StyledFieldGroup>
          <StyledLabel>Job Code</StyledLabel>
          <StyledInput
            value={parsedJD.jobCode}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                jobCode: e.target.value,
              })
            }
            placeholder="Enter job code"
          />
        </StyledFieldGroup> */}

        <StyledFieldGroup>
          <StyledLabel>Location</StyledLabel>
          <StyledInput
            value={parsedJD.jobLocation}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                jobLocation: e.target.value,
              })
            }
            placeholder="Enter location"
            onKeyDown={handleKeyDown}
          />
        </StyledFieldGroup>
        
        <StyledFieldGroup>
          <StyledLabel>Salary Range</StyledLabel>
          <StyledInput
            value={parsedJD.salaryBracket}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                salaryBracket: e.target.value,
              })
            }
            placeholder="Enter salary range"
            onKeyDown={handleKeyDown}
          />
        </StyledFieldGroup>
        
        <StyledFullWidthField>
          <StyledLabel>Short One Line Pitch</StyledLabel>
          <StyledInput
            as="textarea"
            value={parsedJD.description}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                description: e.target.value,
              })
            }
            placeholder="A one line pitch for the job"
            style={{ minHeight: '50px', width: '100%', resize: 'vertical' }}
            onKeyDown={handleKeyDown}
          />
        </StyledFullWidthField>

        {showRecruiterFields && (
          <>
            <StyledFullWidthField>
              <StyledLabel style={{ fontWeight: 'bold', marginTop: '16px' }}>Recruiter Profile Details</StyledLabel>
              <div style={{ fontSize: '14px', marginBottom: '12px', color: '#666' }}>
                To communicate with the candidates for the job.
              </div>
            </StyledFullWidthField>

            {isDefined(missingRecruiterInfo.name) && (
              <StyledFieldGroup>
                <StyledLabel>Recruiter Name</StyledLabel>
                <StyledInput
                  value={missingRecruiterInfo.name}
                  onChange={(e) => updateRecruiterInfoField('name', e.target.value)}
                  placeholder="Enter your full name"
                  onKeyDown={handleKeyDown}
                />
              </StyledFieldGroup>
            )}

            {isDefined(missingRecruiterInfo.phoneNumber) && (
              <StyledFieldGroup>
                <StyledLabel>Phone Number</StyledLabel>
                <StyledInput
                  value={missingRecruiterInfo.phoneNumber}
                  onChange={(e) => updateRecruiterInfoField('phoneNumber', e.target.value)}
                  placeholder="Enter your phone number"
                  onKeyDown={handleKeyDown}
                />
              </StyledFieldGroup>
            )}

            {isDefined(missingRecruiterInfo.jobTitle) && (
              <StyledFieldGroup>
                <StyledLabel>Job Title</StyledLabel>
                <StyledInput
                  value={missingRecruiterInfo.jobTitle}
                  onChange={(e) => updateRecruiterInfoField('jobTitle', e.target.value)}
                  placeholder="Enter your job title"
                  onKeyDown={handleKeyDown}
                />
              </StyledFieldGroup>
            )}

            {isDefined(missingRecruiterInfo.companyDescription) && (
              <StyledFullWidthField>
                <StyledLabel>Company Description</StyledLabel>
                <StyledInput
                  as="textarea"
                  value={missingRecruiterInfo.companyDescription}
                  onChange={(e) => updateRecruiterInfoField('companyDescription', e.target.value)}
                  placeholder="Brief description of your company"
                  style={{ minHeight: '50px', width: '100%', resize: 'vertical' }}
                  onKeyDown={handleKeyDown}
                />
              </StyledFullWidthField>
            )}

            {/* <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={updateRecruiterProfile}
                disabled={isUpdatingProfile}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0052CC',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isUpdatingProfile ? 'not-allowed' : 'pointer',
                  opacity: isUpdatingProfile ? 0.7 : 1,
                }}
              >
                {isUpdatingProfile ? 'Updating...' : 'Update Recruiter Profile'}
              </button>
            </div> */}
          </>
        )}
      </StyledSectionContent>
    </StyledSection>
  );
};
