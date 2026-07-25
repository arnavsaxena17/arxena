import { IconInfoCircle } from 'twenty-ui/icon';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { viewableRecordIdState } from '@/object-record/record-side-panel/states/viewableRecordIdState';
import { viewableRecordNameSingularState } from '@/object-record/record-side-panel/states/viewableRecordNameSingularState';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PhoneCountryPickerDropdownButton } from '@/ui/input/components/internal/phone/components/PhoneCountryPickerDropdownButton';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { gql } from '@apollo/client';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { parsePhoneNumber } from 'libphonenumber-js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactPhoneNumberInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { graphQLToUpdateOneWorkspaceMemberProfile, graphqlToFindManyProjectsWithCandidateValues } from 'twenty-shared/graphql';
import { isDefined } from 'twenty-shared/utils';

import { v4 } from 'uuid';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledFieldGroup,
  StyledFullWidthField,
  StyledInput,
  StyledLabel,
  StyledRemoveButton,
  StyledSection,
  StyledSectionContent
} from './ArxJDUploadModal.styled';

const StyledLabelContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledIconContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
  margin-top: -2px;

  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    top: -10px;
    left: 24px;
    transform: translateY(-100%);
    background-color: ${themeCssVariables.background.primary};
    color: ${themeCssVariables.font.color.primary};
    padding: ${themeCssVariables.spacing[2]};
    border-radius: ${themeCssVariables.border.radius.sm};
    box-shadow: ${themeCssVariables.boxShadow.light};
    width: max-content;
    max-width: 250px;
    z-index: 1000;
    font-size: ${themeCssVariables.font.size.sm};
  }
`;

const StyledPhoneInput = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  width: 100%;
`;

const StyledPhoneInputContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;

  .PhoneInput {
    display: flex;
    align-items: center;
    width: 100%;
    gap: ${themeCssVariables.spacing[1]};
  }

  .PhoneInputInput {
    flex: 1;
    width: 100%;
    background-color: ${themeCssVariables.background.primary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: ${themeCssVariables.border.radius.sm};
    padding: ${themeCssVariables.spacing[2]};
    font-size: ${themeCssVariables.font.size.md};
    color: ${themeCssVariables.font.color.primary};

    &:hover {
      border-color: ${themeCssVariables.border.color.strong};
    }

    &:focus {
      border-color: ${themeCssVariables.border.color.strong};
      outline: none;
    }
  }
`;

const StyledPhoneNumberInput = styled(ReactPhoneNumberInput)`
  width: 100%;

  .PhoneInputCountry {
    position: relative;
    align-items: center;
    display: flex;
    background-color: ${themeCssVariables.background.primary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: ${themeCssVariables.border.radius.sm};
    padding: ${themeCssVariables.spacing[1]};
    margin-right: ${themeCssVariables.spacing[1]};

    &:hover {
      border-color: ${themeCssVariables.border.color.strong};
    }
  }
`;

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

type ProjectDetailsQueryData = {
  projects?: {
    edges?: Array<{
      node?: {
        recruiterId?: string;
        recruiter?: {
          workspaceMemberProfile?: {
            edges?: Array<{
              node?: RecruiterProfileInfo & { id?: string };
            }>;
          };
        };
      };
    }>;
  };
};

// Create mutation for updating workspaceMemberProfile

export const ProjectDetailsForm: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
  onRecruiterInfoChange,
}) => {
  console.log("parsed JD in job details form", parsedJD);

  // Early return if parsedJD is null
  if (!parsedJD) {
    return null;
  }
  const [missingRecruiterInfo, setMissingRecruiterInfo] = useState<RecruiterProfileInfo>({});
  const [showRecruiterFields, setShowRecruiterFields] = useState(false);
  const [recruiterProfile, setRecruiterProfile] = useState<any>(null);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent keyboard event from propagating to global handlers
    e.stopPropagation();
  };

  console.log('currentWorkspaceMember::', currentWorkspaceMember);
  console.log('missingRecruiterInfo::', missingRecruiterInfo);

  const setViewableRecordId = useSetAtomState(viewableRecordIdState);
  const setViewableRecordNameSingular = useSetAtomState(
    viewableRecordNameSingularState,
  );
  const { openRecordInSidePanel } = useOpenRecordInSidePanel();
  const { createOneRecord } = useCreateOneRecord({
    objectNameSingular: 'company',
  });

  const apolloCoreClient = useApolloCoreClient();

  const [executeQuery, { error, data }] = useLazyQuery(gql`
    ${graphqlToFindManyProjectsWithCandidateValues}
  `, { client: apolloCoreClient });

  const [updateWorkspaceMemberProfile] = useMutation(gql`
    ${graphQLToUpdateOneWorkspaceMemberProfile}
  `, { client: apolloCoreClient });

  const { updateOneRecord } = useUpdateOneRecord();

  console.log('recruiterProfile::', recruiterProfile);

  // Memoize workspaceMemberId to prevent unnecessary re-renders
  const workspaceMemberId = useMemo(() => {
    // For existing jobs, use the recruiterId from the job data
    if (parsedJD.id && (data as ProjectDetailsQueryData | undefined)?.projects?.edges?.[0]?.node?.recruiterId) {
      return (data as ProjectDetailsQueryData).projects?.edges?.[0]?.node?.recruiterId;
    }
    // For new jobs, use the current workspace member ID
    return currentWorkspaceMember?.id;
  }, [(data as ProjectDetailsQueryData | undefined)?.projects?.edges, parsedJD.id, currentWorkspaceMember?.id]);

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

        console.log('data in job details form::', data);

        // Check if recruiter profile data exists
        const queryData = data as ProjectDetailsQueryData | undefined;
        const recruiterProfile =
          queryData?.projects?.edges?.[0]?.node?.recruiter?.workspaceMemberProfile
            ?.edges?.[0]?.node;
        console.log('recruiterProfile in job details form::', recruiterProfile);
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
      } else {
        // For new projects(no ID), fetch current user's workspace member profile
        // We need to create a query to get the current user's workspace member profile
        // For now, we'll initialize with empty fields to show the recruiter form
        const missingFields: RecruiterProfileInfo = {
          name: '',
          phoneNumber: '',
          companyDescription: '',
          jobTitle: '',
        };

        setMissingRecruiterInfo(missingFields);
        setShowRecruiterFields(true);
        setRecruiterProfile(null);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
    }
  }, [executeQuery, parsedJD.id]);

  // Check job details when the component mounts or when job ID changes
  useEffect(() => {
    // Always call getJobDetails to initialize recruiter info for both new and existing jobs
    getJobDetails();
  }, [parsedJD.id, getJobDetails]);

  const handleCompanySelect = (company?: { id: string; name: string }) => {
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
    if (field === 'phoneNumber') {
      try {
        // For phone numbers, we store the E.164 format directly
        setMissingRecruiterInfo(prev => ({
          ...prev,
          [field]: value
        }));
      } catch (error) {
        console.error('Error updating phone number:', error);
      }
    } else {
      setMissingRecruiterInfo(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleCreateCompany = async (searchInput?: string) => {
    try {
      const newRecordId = v4();
      const createRecordPayload = {
        id: newRecordId,
        name: searchInput ?? '',
      };

      // Create the company record
      await createOneRecord(createRecordPayload);

      // Open the right drawer to edit company details
      setViewableRecordId(newRecordId);
      setViewableRecordNameSingular('company');
      openRecordInSidePanel({
        recordId: newRecordId,
        objectNameSingular: 'company',
        isNewRecord: true,
      });

      // Update the parsedJD with the new company
      setParsedJD({
        ...parsedJD,
        companyId: newRecordId,
        companyName: searchInput ?? '',
      });
    } catch (error) {
      console.error('Error creating company:', error);
      enqueueErrorSnackBar({ message: 'Failed to create company' });
    }
  };

  const updateRecruiterProfile = async () => {
    console.log('updateRecruiterProfile::', recruiterProfile);
    if (!recruiterProfile?.id) {
      enqueueErrorSnackBar({
        message: 'Unable to update recruiter profile: No profile ID found',
      });
      return false;
    }

    // Only validate the phone format when the user provides one.
    if (missingRecruiterInfo.phoneNumber) {
      try {
        const phoneNumber = parsePhoneNumber(missingRecruiterInfo.phoneNumber);
        if (!phoneNumber?.isValid()) {
          enqueueErrorSnackBar({
            message: 'Please enter a valid phone number with country code',
          });
          return false;
        }
      } catch (error) {
        enqueueErrorSnackBar({
          message: 'Please enter a valid phone number with country code',
        });
        return false;
      }
    }

    try {
      console.log('updateRecruiterProfile::', recruiterProfile);
      console.log('missingRecruiterInfo::', missingRecruiterInfo);
      setIsUpdatingProfile(true);

      // Update the workspace member profile
      await updateWorkspaceMemberProfile({
        variables: {
          idToUpdate: recruiterProfile.id,
          input: {
            ...(missingRecruiterInfo.name && { name: missingRecruiterInfo.name }),
            ...(missingRecruiterInfo.phoneNumber && { phoneNumber: missingRecruiterInfo.phoneNumber }),
            ...(missingRecruiterInfo.companyDescription && { companyDescription: missingRecruiterInfo.companyDescription }),
            ...(missingRecruiterInfo.jobTitle && { jobTitle: missingRecruiterInfo.jobTitle }),
            workspaceMemberId: workspaceMemberId,
          },
        },
      });

      enqueueSuccessSnackBar({
        message: 'Recruiter profile updated successfully',
      });

      // Refresh job details to verify the updates
      await getJobDetails();
      return true;
    } catch (error) {
      console.error('Error updating recruiter profile:', error);
      enqueueErrorSnackBar({
        message: `Failed to update recruiter profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return false;
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleJobFieldUpdate = async (
    field: 'name' | 'jobLocation' | 'salaryBracket',
    value: string,
  ) => {
    if (!parsedJD?.id) return;

    try {
      // Update local state first
      setParsedJD({
        ...parsedJD,
        [field]: value,
      });

      // Update record in Twenty
      await updateOneRecord({
        objectNameSingular: 'project',
        idToUpdate: parsedJD.id,
        updateOneRecordInput: {
          [field]: value,
        },
      });
    } catch (error) {
      console.error(`Error updating job ${field}:`, error);
      enqueueErrorSnackBar({ message: `Failed to update job ${field}` });
    }
  };

  return (
    <StyledSection>
      {/* <StyledSectionHeader>Project Details</StyledSectionHeader> */}
      <StyledSectionContent>
        <StyledFieldGroup>
          <StyledLabelContainer>
            <StyledLabel>Job Title *</StyledLabel>
            <StyledIconContainer data-tooltip="The official title of the position you're hiring for (Required)">
              <IconInfoCircle size={14} />
            </StyledIconContainer>
          </StyledLabelContainer>
          <StyledInput
            value={parsedJD.name}
            onChange={(e) => handleJobFieldUpdate('name', e.target.value)}
            placeholder="Enter job title (Required)"
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (parsedJD.name) {
                handleJobFieldUpdate('name', parsedJD.name);
              }
            }}
          />
        </StyledFieldGroup>

        <StyledFieldGroup>
          <StyledLabelContainer>
            <StyledLabel>Company</StyledLabel>
            <StyledIconContainer data-tooltip="The organization offering this position">
              <IconInfoCircle size={14} />
            </StyledIconContainer>
          </StyledLabelContainer>
          {parsedJD.companyId && parsedJD.companyName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <div style={{ flex: 1 }}>{parsedJD.companyName}</div>
              <StyledRemoveButton onClick={() => handleCompanySelect()}>
                Remove
              </StyledRemoveButton>
            </div>
          ) : (
            <FormSingleRecordPicker
              objectNameSingulars={['company']}
              defaultValue={parsedJD.companyId ?? null}
              onChange={(recordId) => {
                if (typeof recordId === 'string') {
                  setParsedJD({
                    ...parsedJD,
                    companyId: recordId,
                  });
                  return;
                }

                handleCompanySelect(undefined);
              }}
              onMorphItemSelected={(item) => {
                setParsedJD({
                  ...parsedJD,
                  companyId: item.recordId,
                });
              }}
              onClear={() => handleCompanySelect(undefined)}
              onCreate={handleCreateCompany}
            />
          )}
        </StyledFieldGroup>

        {/* <StyledFieldGroup>
          <StyledLabel>Project Code</StyledLabel>
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
          <StyledLabelContainer>
            <StyledLabel>Location</StyledLabel>
            <StyledIconContainer data-tooltip="Where the position is based - can be remote, hybrid, or specific location">
              <IconInfoCircle size={14} />
            </StyledIconContainer>
          </StyledLabelContainer>
          <StyledInput
            value={parsedJD.jobLocation}
            onChange={(e) => handleJobFieldUpdate('jobLocation', e.target.value)}
            placeholder="Enter location"
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (parsedJD.jobLocation) {
                handleJobFieldUpdate('jobLocation', parsedJD.jobLocation);
              }
            }}
          />
        </StyledFieldGroup>

        {/* <StyledFieldGroup>
          <StyledLabelContainer>
            <StyledLabel>Salary Range</StyledLabel>
            <StyledIconContainer data-tooltip="The compensation range for this position">
              <IconInfoCircle size={14} />
            </StyledIconContainer>
          </StyledLabelContainer>
          <StyledInput
            value={parsedJD.salaryBracket}
            onChange={(e) => handleJobFieldUpdate('salaryBracket', e.target.value)}
            placeholder="Enter salary range"
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (parsedJD.salaryBracket) {
                handleJobFieldUpdate('salaryBracket', parsedJD.salaryBracket);
              }
            }}
          />
        </StyledFieldGroup> */}

        <StyledFullWidthField>
          <StyledLabelContainer>
            <StyledLabel>Short One Line Pitch *</StyledLabel>
            <StyledIconContainer data-tooltip="A brief, compelling summary of the job opportunity (Required)">
              <IconInfoCircle size={14} />
            </StyledIconContainer>
          </StyledLabelContainer>
          <StyledInput
            value={parsedJD.description}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                description: e.target.value,
              })
            }
            placeholder="A one line pitch for the project(Required)"
            onKeyDown={handleKeyDown}
          />
        </StyledFullWidthField>

        {showRecruiterFields && (
          <>
              {/* <StyledLabel>Recruiter Profile Details</StyledLabel> */}
              {/* <div style={{ fontSize: '14px', marginBottom: '12px', color: '#666' }}>
                To communicate with the candidates for the job.
              </div> */}

            {isDefined(missingRecruiterInfo.name) && (
              <StyledFieldGroup>
                <StyledLabelContainer>
                  <StyledLabel>Recruiter Name</StyledLabel>
                  <StyledIconContainer data-tooltip="Your full name as it will appear to candidates">
                    <IconInfoCircle size={14} />
                  </StyledIconContainer>
                </StyledLabelContainer>
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
                <StyledLabelContainer>
                  <StyledLabel>Recruiter's Phone Number</StyledLabel>
                  <StyledIconContainer data-tooltip="Your contact number for candidate communications">
                    <IconInfoCircle size={14} />
                  </StyledIconContainer>
                </StyledLabelContainer>
                <StyledPhoneInputContainer>
                  <StyledPhoneNumberInput
                    value={missingRecruiterInfo.phoneNumber}
                    onChange={(value) => updateRecruiterInfoField('phoneNumber', value || '')}
                    placeholder="Enter your phone number (Required)"
                    onKeyDown={handleKeyDown}
                    international={true}
                    withCountryCallingCode={true}
                    countrySelectComponent={PhoneCountryPickerDropdownButton}
                    defaultCountry="IN"
                  />
                </StyledPhoneInputContainer>
              </StyledFieldGroup>
            )}

            {isDefined(missingRecruiterInfo.jobTitle) && (
              <StyledFieldGroup>
                <StyledLabelContainer>
                  <StyledLabel>Recruiter's Job Title</StyledLabel>
                  <StyledIconContainer data-tooltip="Your role in the organization">
                    <IconInfoCircle size={14} />
                  </StyledIconContainer>
                </StyledLabelContainer>
                <StyledInput
                  value={missingRecruiterInfo.jobTitle}
                  onChange={(e) => updateRecruiterInfoField('jobTitle', e.target.value)}
                  placeholder="Enter your job title (Required)"
                  onKeyDown={handleKeyDown}
                />
              </StyledFieldGroup>
            )}

            {isDefined(missingRecruiterInfo.companyDescription) && (
              <StyledFullWidthField>
                <StyledLabelContainer>
                  <StyledLabel>Company Description</StyledLabel>
                  <StyledIconContainer data-tooltip="A brief overview of your company to help candidates understand the organization">
                    <IconInfoCircle size={14} />
                  </StyledIconContainer>
                </StyledLabelContainer>
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
          </>
        )}
      </StyledSectionContent>
    </StyledSection>
  );
};
