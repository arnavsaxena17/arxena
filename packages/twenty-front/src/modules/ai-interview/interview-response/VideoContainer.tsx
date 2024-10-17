import React from 'react';
import styled from '@emotion/styled';

import { StyledControlsOverlay,StyledAnswerTimer, StyledVideoContainer,  StyledRecordButton, ButtonText } from './styled-components/StyledComponentsInterviewResponse';

interface VideoContainerProps {
  children: React.ReactNode;
  answerTimer: number | null;
  isRecording: boolean;
  onRecordingClick: () => void;
}


export const StyledIcon = styled.div`
  width: 20px;
  height: 20px;
  background-color: white;
`;

export const RecordIcon = () => <StyledIcon style={{ borderRadius: '50%' }} />;

export const StopIcon = () => <StyledIcon style={{ width: '14px', height: '14px' }} />;

const VideoContainer: React.FC<VideoContainerProps> = ({ children, answerTimer, isRecording, onRecordingClick }) => (
  <StyledVideoContainer>
    {children}
    {answerTimer !== null && (
      <StyledAnswerTimer>Time left: {answerTimer}s</StyledAnswerTimer>
    )}
    <StyledControlsOverlay onClick={onRecordingClick}>
      <StyledRecordButton isRecording={isRecording}>
        {isRecording ? <StopIcon /> : <RecordIcon />}
      </StyledRecordButton>
      <ButtonText>
        {isRecording ? 'Stop recording' : 'Click to record your response'}
      </ButtonText>
    </StyledControlsOverlay>
  </StyledVideoContainer>
);

export default VideoContainer;