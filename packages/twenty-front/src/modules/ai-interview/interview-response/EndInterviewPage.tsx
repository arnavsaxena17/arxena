import React, { useState } from 'react';
import styled from '@emotion/styled';
import {
  StyledContainer,
  FeedbackContainer,
  StyledMessage,
  ThankYouMessage,
  FeedbackPrompt,
  StyledTextArea,
  SubmitButton,
  StyledLeftPanel,
  StyledRightPanel,
} from './styled-components/StyledComponentsInterviewResponse';



export const EndInterviewPage: React.FC<{ onSubmit: (feedback: string) => void }> = ({ onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    onSubmit(feedback);
    setSubmitted(true);
  };

  return (
    <StyledContainer>
      <StyledLeftPanel>
        <h2>AI Interview</h2>
        <p>Interview Complete</p>
      </StyledLeftPanel>
      <StyledRightPanel>
        {submitted ? (
          <>
            <FeedbackContainer>
            <ThankYouMessage>Thank You for Your Feedback</ThankYouMessage>
            <StyledMessage>
              Your feedback has been submitted successfully. You may now close this window.
            </StyledMessage>
            </FeedbackContainer>

          </>
        ) : (
          <FeedbackContainer>
            <ThankYouMessage>Thank You for Completing the Interview</ThankYouMessage>
            <FeedbackPrompt>
              We appreciate your time and effort. Please share any additional inputs you have for the interviewer or about the interview process.
            </FeedbackPrompt>
            <StyledTextArea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter your feedback here..."
            />
            <SubmitButton onClick={handleSubmit}>Share Feedback</SubmitButton>
          </FeedbackContainer>
        )}
      </StyledRightPanel>
    </StyledContainer>
  );
};