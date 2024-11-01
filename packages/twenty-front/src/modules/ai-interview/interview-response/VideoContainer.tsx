import React, { useEffect } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';

import { StyledControlsOverlay,StyledAnswerTimer, StyledCountdownOverlay,StyledVideoContainer,  StyledRecordButton, ButtonText } from './styled-components/StyledComponentsInterviewResponse';
import { is } from 'date-fns/locale';

interface VideoContainerProps {
  countdown: number | null;
  answerTimer: number | null;
  isRecording: boolean;
  onRecordingClick: () => void;
  webcamRef: React.RefObject<Webcam>;

  setIsPlaying: (isPlaying: boolean) => void;
}


const UnmirroredWebcam =styled(Webcam as any)`
  width: 100%;
  height: 100%;
  transform: scaleX(1);
  -webkit-transform: scaleX(1);
  
  /* Target the internal video element */
  & video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(1) !important;
    -webkit-transform: scaleX(1) !important;
  }
`;

const TimerContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  font-family: sans-serif;
  // justify-content: flex-end; /* This will float the container to the right */
  justify-content: center; /* This will float the container to the center */

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
  answerTimer, 
  isRecording, 
  onRecordingClick,
  setIsPlaying,
  countdown,
  webcamRef,

}) => {
  console.log("Anshwer TIme:", answerTimer, "isRecording:", isRecording)
  const totalTime = 240; // 4 minutes in seconds
  const timeRemaining = isRecording ? (answerTimer ?? totalTime) : totalTime;
  console.log("timeRemaining:", timeRemaining)
  const isNearingEnd = (timeRemaining ?? totalTime) <= 30;
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };


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
      <UnmirroredWebcam
          audio={true}
          ref={webcamRef}
          videoConstraints={videoConstraints}
          mirrored={true}
          screenshotFormat="image/jpeg"
        />
        <StyledControlsOverlay onClick={handleRecordingClick}>
          <StyledRecordButton isRecording={isRecording}>
            {isRecording ? <StopIcon /> : <RecordIcon />}
          </StyledRecordButton>
          <ButtonText>
            {isRecording ? 'Stop recording' : 'Click to record your response'}
          </ButtonText>
        </StyledControlsOverlay>
        {countdown !== null && <StyledCountdownOverlay>{countdown}</StyledCountdownOverlay>}

      </StyledVideoContainer>
    </div>
  );
};



export default VideoContainer;