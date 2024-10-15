import React from 'react';
import styled from '@emotion/styled';
import * as InterviewResponseTypes from './types/interviewResponseTypes';
// import * as InterviewResponseStyles from './styled-components/StyledComponentsInterviewResponse';
import { StyledContainer, StyledTextLeftPanel, StyledLeftPanel, StyledRightPanel, StyledButton } from './styled-components/StyledComponentsInterviewResponse';

export const StartInterviewPage: React.FC<InterviewResponseTypes.StartInterviewPageProps> = ({
  onStart,
  candidateName,
  positionName,
  introduction,
  instructions
}) => {
  return (
    <StyledContainer>
      <StyledLeftPanel>
        <StyledTextLeftPanel>Interview - .NET Developer II</StyledTextLeftPanel>
      </StyledLeftPanel>
      <StyledRightPanel>
        <h1>Welcome to your AI Interview, {candidateName}. You are applying for {positionName}</h1>
        <div className="introduction">
        <h3>Introduction</h3>
        <p>{introduction}</p>
        </div>

        <p>This interview will consist of several questions. Please ensure you have a stable internet connection and a working camera and microphone.</p>
        <p>When you're ready to begin, click the Start Interview button.</p>
        <StyledButton onClick={onStart}>Start Interview</StyledButton>
      </StyledRightPanel>
    </StyledContainer>
  );
};
