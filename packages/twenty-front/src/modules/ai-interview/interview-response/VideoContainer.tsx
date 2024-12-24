import React, { useEffect, useRef, useState } from 'react';
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
  interviewTime: number;
}


// In VideoContainer.tsx
const UnmirroredWebcam = styled(Webcam as any)`
  width: 100%;
  height: 100%;
  transform: scaleX(-1); // Mirror the preview
  -webkit-transform: scaleX(-1);
  
  & video {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
  interviewTime

}) => {
  const [isStreamInitialized, setIsStreamInitialized] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  console.log("Anshwer TIme:", answerTimer, "isRecording:", isRecording)
  const totalTime = interviewTime; // 4 minutes in seconds
  const timeRemaining = isRecording ? (answerTimer ?? totalTime) : totalTime;
  console.log("timeRemaining:", timeRemaining)
  const isNearingEnd = (timeRemaining ?? totalTime) <= 30;
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };


  useEffect(() => {
    const initializeMediaRecorder = async () => {
      if (webcamRef.current?.stream && !isStreamInitialized) {
        try {
          // Create and initialize MediaRecorder instance but don't start recording
          mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, {
            mimeType: 'video/webm'
          });
          
          // Add basic event handlers
          mediaRecorderRef.current.addEventListener('error', (error) => {
            console.error('MediaRecorder error:', error);
          });
          
          setIsStreamInitialized(true);
        } catch (error) {
          console.error('Failed to initialize MediaRecorder:', error);
        }
      }
    };

    initializeMediaRecorder();
  }, [webcamRef.current?.stream, isStreamInitialized]);


  const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
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
          audioConstraints={audioConstraints}
          mirrored={true} // Show mirrored preview
          screenshotFormat="image/jpeg"
          onUserMedia={(stream:any) => {
            // Mute the audio output when the stream starts
            if (webcamRef.current && webcamRef.current.video) {
              webcamRef.current.video.muted = true;
            }
          }}

        />
        <StyledControlsOverlay onClick={handleRecordingClick}>
          <StyledRecordButton isRecording={isRecording}>
            {isRecording ? <StopIcon /> : <RecordIcon />}
          </StyledRecordButton>
          <ButtonText>
            {isRecording ? 'Stop Recording and Submit' : 'Click to record your response'}
          </ButtonText>
        </StyledControlsOverlay>
        {countdown !== null && <StyledCountdownOverlay>{countdown}</StyledCountdownOverlay>}

      </StyledVideoContainer>
    </div>
  );
};



export default VideoContainer;