import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  EndInterviewStyledContainer,
  FeedbackContainer,
  StyledMessage,
  FeedbackPrompt,
  StyledTextArea,
  SubmitButton,
  EndInterviewStyledLeftPanel,
  EndInterviewStyledRightPanel,
} from './styled-components/StyledComponentsInterviewResponse';
import { InterviewData } from './types/interviewResponseTypes';

interface EndInterviewPageProps {
  interviewData: InterviewData;
  onSubmit: (feedback: string) => void;
  submissionComplete: boolean;
}



export const EndInterviewPage: React.FC<EndInterviewPageProps> = ({ 
  interviewData, 
  onSubmit, 
  submissionComplete 
}) => {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showCloseMessage, setShowCloseMessage] = useState(false);


  useEffect(() => {
    if (submissionComplete) {
      const timer = setTimeout(() => {
        setShowCloseMessage(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [submissionComplete]);
  

  
  const handleSubmit = () => {
    onSubmit(feedback);
    setSubmitted(true);
  };
  return (
    <EndInterviewStyledContainer>
      <EndInterviewStyledLeftPanel>
        <h2>{interviewData.candidate.jobs.name}</h2>
        <p>Interview Complete</p>
      </EndInterviewStyledLeftPanel>
      <EndInterviewStyledRightPanel>
        {submitted ? (
          <FeedbackContainer>
            <h2>Thank You for Your Feedback</h2>
            <StyledMessage>
              Your feedback has been submitted successfully.
            </StyledMessage>
          </FeedbackContainer>
        ) : (
          <FeedbackContainer>
            <h2>Thank You for Completing the Interview</h2>
            {!showCloseMessage ? (
              <FeedbackPrompt>
                We are uploading your responses. Please do not close this tab.
              </FeedbackPrompt>
            ) : (
              <FeedbackPrompt>
                Your responses have been successfully uploaded. You may now close this window.
              </FeedbackPrompt>
            )}
          </FeedbackContainer>
        )}
      </EndInterviewStyledRightPanel>
    </EndInterviewStyledContainer>
  );
};
