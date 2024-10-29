import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuid } from 'uuid';
import * as InterviewResponseTypes from './types/interviewResponseTypes';
import { VideoPlayer } from './utils/videoPlaybackUtils';
import VideoContainer from './VideoContainer';



import {
  StyledLeftPanelContentBox,
  StyledTextLeftPanelTextHeadline,
  StyledTextLeftPaneldisplay,
  // StyledLeftPanel,
  // StyledRightPanel,
  StyledCountdownOverlay,
  StyledMessage,
  StyledTimer,
  StyledError,
  SnapScrollContainer,
  StyledLeftPanel,
  StyledRightPanel,
  // StyledButton,
  // ButtonContainer,
  // InstructionSection,
  // InstructionList,
  // AccessMessage,
} from './styled-components/StyledComponentsInterviewResponse';

const UnmirroredWebcam = styled(Webcam as any)`
  width: 100%;
  height: 100%;
  transform: scaleX(1) !important;
  -webkit-transform: scaleX(1) !important;
  
  /* Target the internal video element specifically */
  & video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(1) !important;
    -webkit-transform: scaleX(1) !important;
  }
  
  /* Safari-specific fixes */
  @media not all and (min-resolution:.001dpcm) { 
    @supports (-webkit-appearance:none) {
      & video {
        transform: scaleX(1) !important;
        -webkit-transform: scaleX(1) !important;
      }
    }
  }
`;




const ffmpeg = createFFmpeg({
  // corePath: `/ffmpeg/ffmpeg-core.js`,
  // I've included a default import above (and files in the public directory), but you can also use a CDN like this:
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  log: true,
});

export const InterviewPage: React.FC<InterviewResponseTypes.InterviewPageProps> = ({ InterviewData, questions, introductionVideoAttachment, questionsVideoAttachment, currentQuestionIndex, onNextQuestion, onFinish }) => {
  console.log('These are questions::', questions);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [activeCameraFeed, setActiveCameraFeed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [answerTimer, setAnswerTimer] = useState<number | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  useEffect(() => {
    checkCamera();
  }, []);

  useEffect(() => {
    if (timer !== null && timer > 0) {
      const timerId = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timer === 0) {
      moveToNextQuestion();
    }
  }, [timer]);

  useEffect(() => {
    if (answerTimer !== null && answerTimer > 0) {
      const answerTimerId = setTimeout(() => setAnswerTimer(answerTimer - 1), 1000);
      return () => clearTimeout(answerTimerId);
    } else if (answerTimer === 0) {
      handleStopRecording();
    }
  }, [answerTimer]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const countdownId = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(countdownId);
    } else if (countdown === 0) {
      setCountdown(null);
      startRecording();
    }
  }, [countdown]);

  const handleStartRecording = () => {
    resetAndStopVideo(); // Stop and reset video before starting recording
    setRecording(true);
    setCountdown(5);
  };

  const startRecording = () => {
    setRecording(true);
    setRecorded(false);
    setError(null);
    setRecordedChunks([]);
    setAnswerTimer(240);
    const stream = webcamRef.current?.stream;
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current.start();
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const resetAndStopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };
  const moveToNextQuestion = () => {
    console.log('Currnet question index:', currentQuestionIndex);
    if (currentQuestionIndex < questions.length) {
      setRecordedChunks([]);
      setError(null);
      setTimer(null);
      setActiveCameraFeed(true);
      setRecording(false);
      setRecorded(false);
      setSubmitting(false);
      setCountdown(null);
      setAnswerTimer(null);
    } else {
      onFinish();
    }
  };

  const checkCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCamera(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      setHasCamera(false);
      setError('Camera not available. Please check your device settings.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      resetAndStopVideo();
      setActiveCameraFeed(false);
      setRecording(false);
      setRecorded(true);
      setAnswerTimer(null);
    }
  };

  const handleDataAvailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      setRecordedChunks(prev => [...prev, event.data]);
    }
  };

  useEffect(() => {
    if (recorded && recordedChunks.length > 0) {
      handleSubmit();
    }
  }, [recorded, recordedChunks]);

  const handleSubmit = async () => {
    if (recordedChunks.length) {
      setError(null);
      setSubmitting(true);
      if (!isLastQuestion) {
        setTimer(5);
      }

      const file = new Blob(recordedChunks, {
        type: `video/webm`,
      });
      try {
        const unique_id = uuid();
        if (!ffmpeg.isLoaded()) {
          await ffmpeg.load();
        }

        ffmpeg.FS('writeFile', `${unique_id}.webm`, await fetchFile(file));
        await ffmpeg.run('-i', `${unique_id}.webm`, '-vn', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '16000', `${unique_id}.wav`);
        // This reads the converted file from the file system
        const fileData = ffmpeg.FS('readFile', `${unique_id}.wav`);
        const output = new Blob([fileData], {
          type: 'audio/wav',
        });
        const formData = new FormData();
        formData.append('operations', '{}');
        formData.append('map', '{}');
        formData.append('model', 'whisper-12');
        // formData.append('question2', 'Whats the question');
        formData.append('video', file, `${InterviewData.id}-video-${unique_id}.webm`);
        formData.append('video', file, `${InterviewData.id}-video-${unique_id}.webm`);
        formData.append('audio', output, `${InterviewData.id}-audio-${unique_id}.wav`);
        // formData.forEach((value, key) => {
          // console.log(key, value);
        // });
        console.log('This is the form data:', formData);
        onNextQuestion(formData);
        setSubmitting(false);
        if (isLastQuestion) {
          onFinish();
        }
      } catch (error) {
        console.error('Error submitting response:', error);
        setSubmitting(false);
        setError('Failed to submit response. Please try again.');
      }
    }
  };
  if (!hasCamera) {
    return <StyledError>{error}</StyledError>;
  }

  console.log("Current question interview attachment: for question index:", currentQuestionIndex);
  console.log("Current question interview questionsVideoAttachment:", questionsVideoAttachment);
  
  const currentQuestionInterviewAttachment = questionsVideoAttachment.find(
    (attachment) => attachment?.id === questions[currentQuestionIndex]?.attachments?.edges[0]?.node?.id
  )?.fullPath;


  const currentQuestionVideoURL = process.env.REACT_APP_SERVER_BASE_URL + "/files/" + currentQuestionInterviewAttachment;
  console.log("This is the currentQuestionVideoURL::", currentQuestionVideoURL)
  // Add videoConstraints inside the component
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
    advanced: [{
      transform: "none"
    }]
  };
  


  return (
    <SnapScrollContainer>
      <StyledLeftPanel>
        <h2>{InterviewData.candidate.jobs.name}</h2>
        <StyledLeftPanelContentBox>
          <StyledTextLeftPanelTextHeadline>
            Question {currentQuestionIndex + 1} of {questions.length}
          </StyledTextLeftPanelTextHeadline>
          <VideoPlayer
            src={currentQuestionVideoURL}
            videoRef={videoRef}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
          <h3>Transcript</h3>
          <StyledTextLeftPaneldisplay>{questions[currentQuestionIndex].questionValue}</StyledTextLeftPaneldisplay>
        </StyledLeftPanelContentBox>
      </StyledLeftPanel>
      <StyledRightPanel>
        <div>
          <h2>{questions[currentQuestionIndex].name}</h2>
          <p>{questions[currentQuestionIndex].questionValue}</p>
        </div>
        {activeCameraFeed && (
          <VideoContainer
            answerTimer={answerTimer}
            isRecording={recording}
            onRecordingClick={recording ? handleStopRecording : handleStartRecording}
            setIsPlaying={setIsPlaying}  
          >
          <UnmirroredWebcam
            audio={true}
            ref={webcamRef}
            videoConstraints={videoConstraints}
            mirrored={false}
            screenshotFormat="image/jpeg"
            style={{
              transform: 'scaleX(1)',
              WebkitTransform: 'scaleX(1)'
            }}
          />
            {/* {countdown !== null && <StyledCountdownOverlay>{countdown}</StyledCountdownOverlay>} */}
            {countdown !== null && <StyledCountdownOverlay>{countdown}</StyledCountdownOverlay>}
          </VideoContainer>
        )}
        {submitting && <StyledMessage>Submitting your response...</StyledMessage>}
        {timer !== null && (
          <>
            <StyledMessage>Response submitted successfully! Moving to next question in:</StyledMessage>
            <StyledTimer>{timer}</StyledTimer>
          </>
        )}
        {error && <StyledError>{error}</StyledError>}
      </StyledRightPanel>
    </SnapScrollContainer>
  );
};