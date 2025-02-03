import React, { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';

import { StyledControlsOverlay,StyledAnswerTimer, StyledCountdownOverlay,StyledVideoContainer,  StyledRecordButton, ButtonText } from './styled-components/StyledComponentsInterviewResponse';
import { is } from 'date-fns/locale';
import { useStream } from '../StreamManager';

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
    // height: 100%;
    object-fit: cover;
  }
`;




const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 1000;
`;

const LoaderCard = styled.div`
  background-color: white;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const SpinnerContainer = styled.div`
  width: 48px;
  height: 48px;
  position: relative;
`;

const Spinner = styled.div`
  width: 100%;
  height: 100%;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const LoaderText = styled.p`
  font-size: 18px;
  font-weight: 500;
  color: #333;
`;

const ErrorOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 1000;
`;

const ErrorMessage = styled.div`
  background-color: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  color: #dc2626;
  font-size: 16px;
  font-weight: 500;
  max-width: 400px;
  text-align: center;
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
  const { stream, isStreamReady, error, getWarmedUpRecorder } = useStream();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecorderInitialized, setIsRecorderInitialized] = useState(false);
  // const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

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
    if (stream && webcamRef.current?.video) {
      webcamRef.current.video.srcObject = stream;
    }
  }, [stream]);

  const handleDataAvailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      setRecordedChunks(prev => [...prev, event.data]);
    }
  };




  useEffect(() => {
    if (isRecording) {
      const recorder = getWarmedUpRecorder();
      if (recorder) {
        recorder.ondataavailable = handleDataAvailable;
        recorder.start();
      }
    }
  }, [isRecording]);



  const handleRecordingClick = () => {
    if (!isRecording) {
      // Ensure we have a fresh recorder for each new recording
      const recorder = getWarmedUpRecorder();
      if (recorder) {
        setIsPlaying(false);
        onRecordingClick();
      }
    } else {
      const recorder = getWarmedUpRecorder();
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
      onRecordingClick();
    }
  };


  // useEffect(() => {
  //   if (stream && webcamRef.current && !isRecorderInitialized) {
  //     webcamRef.current.video!.srcObject = stream;
      
  //     try {
  //       mediaRecorderRef.current = new MediaRecorder(stream, {
  //         mimeType: 'video/webm',
  //         videoBitsPerSecond: 1000000
  //       });
        
  //       setIsRecorderInitialized(true);
  //     } catch (error) {
  //       console.error('Failed to initialize MediaRecorder:', error);
  //     }
  //   }
  // }, [stream, isRecorderInitialized]);

  // Show loading state if stream isn't ready
  if (!isStreamReady) {
    return (
      <LoadingOverlay>
        <LoaderCard>
          <SpinnerContainer>
            <Spinner />
          </SpinnerContainer>
          <LoaderText>Preparing camera...</LoaderText>
        </LoaderCard>
      </LoadingOverlay>
    );
  }

  if (error) {
    return (
      <ErrorOverlay>
        <ErrorMessage>Failed to access camera: {error.message}</ErrorMessage>
      </ErrorOverlay>
    );
  }




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

  // const handleRecordingClick = () => {
  //   if (isRecording) {
  //     setIsPlaying(false);
  //   }
  //   console.log("isRecording:", isRecording)
  //   onRecordingClick();
  // };


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