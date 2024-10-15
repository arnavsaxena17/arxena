import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import * as InterviewResponseTypes from './types/interviewResponseTypes';
// import * as InterviewResponseStyles from './styled-components/StyledComponentsInterviewResponse';
import {
  StyledContainer,
  StyledLeftPanelContentBox,
  StyledTextLeftPanelHeadline,
  StyledTextLeftPanelTextHeadline,
  StyledTextLeftPanelVideoPane,
  StyledTextLeftPaneldisplay,
  StyledLeftPanel,
  StyledRightPanel,
  StyledButton,
  
} from './styled-components/StyledComponentsInterviewResponse';


const InstructionSection = styled.div`
  margin-bottom: 15px;
`;

const InstructionList = styled.ol`
  padding-left: 20px;
  margin: 5px 0;
`;

const AccessMessage = styled.p`
  color: green;
  margin: 10px 0;
`;

const TermsLink = styled.a`
  color: blue;
  text-decoration: underline;
  margin-bottom: 10px;
  display: inline-block;
`;
export const StartInterviewPage: React.FC<InterviewResponseTypes.StartInterviewPageProps> = ({ onStart, candidateName, positionName, introduction, instructions }) => {

  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkMediaAccess();
  }, []);

  const checkMediaAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setHasAccess(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      setHasAccess(false);
    }
  };

  const requestMediaAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setHasAccess(true);
    } catch (err) {
      console.error('Failed to get media access:', err);
      alert('Failed to get camera and microphone access. Please check your browser settings and try again.');
    }
  };


  return (
    <StyledContainer>
    <StyledLeftPanel>
      <h2>Interview - .NET Developer II</h2>
      <StyledLeftPanelContentBox>
        <StyledTextLeftPanelTextHeadline>Introduction</StyledTextLeftPanelTextHeadline>
        <StyledTextLeftPanelVideoPane />
        <h3>Transcript</h3>
        <StyledTextLeftPaneldisplay>
          Hi, I am John and I will be your guide to this interview. Congratulations on making it this far. On the right side of this page you will find instructions related to the interview process. Kindly follow them for a smooth interview
          process.
        </StyledTextLeftPaneldisplay>
      </StyledLeftPanelContentBox>
    </StyledLeftPanel>
    <StyledRightPanel>
      <div>
        <InstructionSection>
          <h2>Instructions</h2>
          <h3>General</h3>
          <InstructionList>
            <li>Please make sure you have a stable internet connection and use a fully charged device for giving the interview. Kindly avoid closing or refreshing the tab or browser to prevent loss of progress.</li>
            <li>For the course of this interview, some questions require responses in real time video recording format and some require responses in textual format. For every question, you will be provided with transcript for clarity about the questions</li>
            <li>Please provide your browser access to camera and microphone on your device to start interview</li>
          </InstructionList>
        </InstructionSection>
        
        {!hasAccess && (
          <StyledButton onClick={requestMediaAccess}>Give camera and microphone access</StyledButton>
        )}
        {hasAccess && (
          <AccessMessage>✓ Camera and microphone access granted</AccessMessage>
        )}
        
        <InstructionSection>
          <h3>Responses</h3>
          <InstructionList>
            <li>Every question which requires a real time recording will have a time limit depending on the question length and complexity. As for questions which require textual responses, there will be no time limit</li>
            <li>A maximum of 3 retakes are allowed for real time video recording responses. Uploading a pre-recorded video is not allowed and the timer will start as soon as video recording starts</li>
          </InstructionList>
        </InstructionSection>
        
        <InstructionSection>
          <h3>Others</h3>
          <InstructionList>
            <li>Please avoid distractions during the interview and avoid interacting with family members.</li>
          </InstructionList>
        </InstructionSection>
        <TermsLink href="#">Terms and Conditions</TermsLink>
      </div>
      
      <div>
        <StyledButton style={{ backgroundColor: '#4285f4', color: 'white', width: '100%' }} onClick={onStart} disabled={!hasAccess} > Start Interview </StyledButton>
      </div>
    </StyledRightPanel>
  </StyledContainer>
); 
};
