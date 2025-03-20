import React from 'react';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledFieldGroup,
  StyledInput,
  StyledLabel,
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader,
} from './ArxJDUploadModal.styled';

export const JobDetailsForm: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <StyledSection>
      <StyledSectionHeader>Job Details</StyledSectionHeader>
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
            onKeyDown={handleKeyDown}
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
        {/* 
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
        </StyledFieldGroup> */}
        {/* 
        <StyledFullWidthField>
          <StyledLabel>Description</StyledLabel>
          <StyledInput
            as="textarea"
            value={parsedJD.description}
            onChange={(e) =>
              setParsedJD({
                ...parsedJD,
                description: e.target.value,
              })
            }
            placeholder="Enter job description"
            style={{ minHeight: '100px', resize: 'vertical' }}
            onKeyDown={handleKeyDown}
          />
        </StyledFullWidthField> */}

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
            onKeyDown={handleKeyDown}
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
            onKeyDown={handleKeyDown}
          />
        </StyledFieldGroup> */}
      </StyledSectionContent>
    </StyledSection>
  );
};
