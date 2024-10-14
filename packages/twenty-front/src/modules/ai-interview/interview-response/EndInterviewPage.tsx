import React, { useState } from 'react';
import styled from '@emotion/styled';

const StyledContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: ${({ theme }) => theme.background.tertiary};
`;

const StyledLeftPanel = styled.div`
  width: calc(100% * (1 / 3));
  max-width: 300px;
  min-width: 224px;
  padding: 44px 32px;
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledRightPanel = styled.div`
  width: calc(100% * (2 / 3));
  min-width: 264px;
  padding: 44px 32px;
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 44px;
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  height: 100px;
  margin-bottom: 20px;
  padding: 10px;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledButton = styled.button`
  padding: 10px 20px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledMessage = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.md};
`;


export const EndInterviewPage: React.FC<{ onSubmit: (feedback: string) => void }> = ({ onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    onSubmit(feedback);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <StyledContainer>
        <StyledLeftPanel>
          <h2>AI Interview</h2>
          <p>Interview Complete</p>
        </StyledLeftPanel>
        <StyledRightPanel>
          <h1>Thank You for Your Feedback</h1>
          <StyledMessage>
            Your feedback has been submitted successfully. You may now close this window.
          </StyledMessage>
        </StyledRightPanel>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledLeftPanel>
        <h2>AI Interview</h2>
        <p>Interview Complete</p>
      </StyledLeftPanel>
      <StyledRightPanel>
        <h1>Thank You for Completing the Interview</h1>
        <p>We appreciate your time and effort. Please provide any feedback you have about the interview process.</p>
        <StyledTextArea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Enter your feedback here..."
        />
        <StyledButton onClick={handleSubmit}>Submit Feedback</StyledButton>
      </StyledRightPanel>
    </StyledContainer>
  );
};
