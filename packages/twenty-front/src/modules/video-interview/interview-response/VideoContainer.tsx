import { styled } from '@linaria/react';
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useStream } from '../StreamManager';
import { ButtonText, StyledControlsOverlay, StyledCountdownOverlay, StyledRecordButton, StyledVideoContainer } from './StyledComponentsInterviewResponse';

interface VideoContainerProps {
  countdown: number | null;
  answerTimer: number | null;
  isRecording: boolean;
  onRecordingClick: () => void;
  webcamRef: React.RefObject<React.ElementRef<typeof Webcam> | null>;

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
  align-items: center;
  backdrop-filter: blur(4px);
  background-color: rgba(0, 0, 0, 0.5);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1000;
`;

const LoaderCard = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border-radius: 8px;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px;
`;

const SpinnerContainer = styled.div`
  height: 48px;
  position: relative;
  width: 48px;
`;

const Spinner = styled.div`
  animation: spin 1s linear infinite;
  border: 4px solid #f3f3f3;
  border-radius: 50%;
  border-top: 4px solid #3498db;
  height: 100%;
  width: 100%;

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
  color: #333;
  font-size: 18px;
  font-weight: 500;
`;

const ErrorOverlay = styled.div`
  align-items: center;
  backdrop-filter: blur(4px);
  background-color: rgba(0, 0, 0, 0.5);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1000;
`;

const ErrorMessage = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border-radius: 8px;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  color: #dc2626;
  font-size: 16px;
  font-weight: 500;
  max-width: 400px;
  padding: 24px;
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
  align-items: center;
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: 8px;
  display: flex;
  gap: 4px;
  padding: 8px 16px;
`;

const TimerValue = styled.span`
  color: ${props => props.color || themeCssVariables.font.color.primary};
  font-weight: 600;
`;

export const StyledIcon = styled.div`
  background-color: ${themeCssVariables.background.primary};
  height: 20px;
  width: 20px;
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
