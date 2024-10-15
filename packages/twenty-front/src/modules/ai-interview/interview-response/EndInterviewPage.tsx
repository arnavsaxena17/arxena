import React, { useState } from 'react';
import styled from '@emotion/styled';
import {
  StyledContainer,
  StyledLeftPanel,
  StyledRightPanel,
} from './styled-components/StyledComponentsInterviewResponse';

const FeedbackContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  height: 150px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: #4285f4;
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
  }
`;

const SubmitButton = styled.button`
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  align-self: flex-start;

  &:hover {
    background-color: #3367d6;
  }
`;

const ThankYouMessage = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
`;

const FeedbackPrompt = styled.p`
  font-size: 16px;
  color: #666;
  margin-bottom: 20px;
`;

const StyledMessage = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
  font-size: 16px;
`;

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