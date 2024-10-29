import React, { useEffect } from 'react';
import styled from '@emotion/styled';

import { StyledControlsOverlay,StyledAnswerTimer, StyledVideoContainer,  StyledRecordButton, ButtonText } from './styled-components/StyledComponentsInterviewResponse';
import { is } from 'date-fns/locale';

interface VideoContainerProps {
  children: React.ReactNode;
  answerTimer: number | null;
  isRecording: boolean;
  onRecordingClick: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

const TimerContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  font-family: sans-serif;
`;

const TimerBox = styled.div`
  background-color: #f3f4f6;
  padding: 8px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const TimerValue = styled.span`
  font-weight: 600;
  color: ${props => props.color || '#374151'};
`;

export const StyledIcon = styled.div`
  width: 20px;
  height: 20px;
  background-color: white;
`;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};


export const RecordIcon = () => <StyledIcon style={{ borderRadius: '50%' }} />;

export const StopIcon = () => <StyledIcon style={{ width: '14px', height: '14px' }} />;

const VideoContainer: React.FC<VideoContainerProps> = ({ 
  children, 
  answerTimer, 
  isRecording, 
  onRecordingClick,
  setIsPlaying

}) => {
  console.log("Anshwer TIme:", answerTimer, "isRecording:", isRecording)
  const totalTime = 240; // 4 minutes in seconds
  const timeRemaining = isRecording ? (answerTimer ?? totalTime) : totalTime;
  console.log("timeRemaining:", timeRemaining)
  const isNearingEnd = (timeRemaining ?? totalTime) <= 30;


  useEffect(() => {
    if (isRecording) {
      setIsPlaying(false);
      console.log("isRecording:", isRecording)
    }
    
  }, [isRecording, setIsPlaying]);

  const handleRecordingClick = () => {
    if (isRecording) {
      setIsPlaying(false);
    }
    console.log("isRecording:", isRecording)
    onRecordingClick();
  };


  return (
    <div className="space-y-4">
      <TimerContainer>
        <TimerBox>
          <span>{isRecording ? 'Time Remaining:' : 'Total Time:'}</span>
          <TimerValue color={isNearingEnd && isRecording ? '#dc2626' : undefined}>
            {formatTime(isRecording ? timeRemaining : totalTime)}
          </TimerValue>
        </TimerBox>
      </TimerContainer>

      <StyledVideoContainer>
        {children}
        <StyledControlsOverlay onClick={handleRecordingClick}>
          <StyledRecordButton isRecording={isRecording}>
            {isRecording ? <StopIcon /> : <RecordIcon />}
          </StyledRecordButton>
          <ButtonText>
            {isRecording ? 'Stop recording' : 'Click to record your response'}
          </ButtonText>
        </StyledControlsOverlay>
      </StyledVideoContainer>
    </div>
  );
};



export default VideoContainer;