import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { viewableRecordIdState } from '@/object-record/record-right-drawer/states/viewableRecordIdState';
import { viewableRecordNameSingularState } from '@/object-record/record-right-drawer/states/viewableRecordNameSingularState';
import { SingleRecordSelectMenuItemsWithSearch } from '@/object-record/relation-picker/components/SingleRecordSelectMenuItemsWithSearch';
import { useAddNewRecordAndOpenRightDrawer } from '@/object-record/relation-picker/hooks/useAddNewRecordAndOpenRightDrawer';
import { RecordForSelect } from '@/object-record/relation-picker/types/RecordForSelect';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import React, { useState } from 'react';
import { useSetRecoilState } from 'recoil';
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

export const JobDetailsForm: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent keyboard event from propagating to global handlers
    e.stopPropagation();
  };

  const [companySearchInput, setCompanySearchInput] = useState('');
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

  // const { records: companies } = useFindManyRecords({
  //   objectNameSingular: 'company',
  //   filter: companySearchInput
  //     ? {
  //         name: {
  //           ilike: `%${companySearchInput}%`,
  //         },
  //       }
  //     : undefined,
  // });

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

        {/* <StyledFieldGroup>
          <StyledLabel>Specific Criteria</StyledLabel>
          <StyledInput
            value={parsedJD.specificCriteria}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                specificCriteria: e.target.value,
              })
            }
            placeholder="Enter specific criteria"
          />
        </StyledFieldGroup>

        <StyledFieldGroup>
          <StyledLabel>Path Position</StyledLabel>
          <StyledInput
            value={parsedJD.pathPosition}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                pathPosition: e.target.value,
              })
            }
            placeholder="Enter path position"
          /> */}
      </StyledSectionContent>
    </StyledSection>
  );
};
