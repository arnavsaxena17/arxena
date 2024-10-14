import React from 'react';
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

const StyledButton = styled.button`
  padding: 10px 20px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.md};
`;

interface StartInterviewPageProps {
  onStart: () => void;
  candidateName: string;
  positionName: string;
  introduction: string;
  instructions: string;
}


export const StartInterviewPage: React.FC<StartInterviewPageProps> = ({
  onStart,
  candidateName,
  positionName,
  introduction,
  instructions
}) => {
  return (
    <StyledContainer>
      <StyledLeftPanel>
        <h2>AI Interview</h2>
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
