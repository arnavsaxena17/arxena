import React from 'react';
import { ParsedJD } from '../types/ParsedJD';
import {
  StyledFormGrid,
  StyledFullWidthField,
  StyledParsedContent,
  StyledSectionDivider,
} from './ArxJDUploadModal.styled';
import { ChatFlowSection } from './ChatFlowSection';
import { ChatQuestionsSection } from './ChatQuestionsSection';
import { JobDetailsForm } from './JobDetailsForm';
import { MeetingSchedulingSection } from './MeetingSchedulingSection';
import { VideoQuestionsSection } from './VideoQuestionsSection';

type ParsedJDFormProps = {
  parsedJD: ParsedJD;
  setParsedJD: (jd: ParsedJD) => void;
  onRecruiterInfoChange?: any;
};

// Main Component that uses all the subcomponents in a vertical layout
export const ParsedJDForm: React.FC<ParsedJDFormProps> = ({
  parsedJD,
  setParsedJD,
  onRecruiterInfoChange,
}) => {
  return (
    <StyledParsedContent>
      <StyledFormGrid>
        {/* Job Details */}
        <JobDetailsForm parsedJD={parsedJD} setParsedJD={setParsedJD} onRecruiterInfoChange={onRecruiterInfoChange} />

        <StyledSectionDivider />

        {/* Chatbot Section */}
        <StyledFullWidthField>
          <ChatFlowSection parsedJD={parsedJD} setParsedJD={setParsedJD} />
          <ChatQuestionsSection parsedJD={parsedJD} setParsedJD={setParsedJD} />
        </StyledFullWidthField>

        <StyledSectionDivider />

        {/* Video Interview Section */}
        <StyledFullWidthField>
          <VideoQuestionsSection
            parsedJD={parsedJD}
            setParsedJD={setParsedJD}
          />
        </StyledFullWidthField>

        <StyledSectionDivider />

        {/* Meeting Scheduling Section */}
        <StyledFullWidthField>
          <MeetingSchedulingSection
            parsedJD={parsedJD}
            setParsedJD={setParsedJD}
          />
        </StyledFullWidthField>
      </StyledFormGrid>
    </StyledParsedContent>
  );
};
