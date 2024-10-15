import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuid } from 'uuid';
import * as InterviewResponseTypes from './types/interviewResponseTypes';


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

const StyledAnswerTimer = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 5px;
`;



const StyledCountdownOverlay = styled.div`
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 72px;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 20px;
  border-radius: 50%;
  width: 120px;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
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

const StyledVideoContainer = styled.div`
  background-color: black;
  height: 60%;
  margin-bottom: 20px;
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
  text-align: center;
`;

const StyledTimer = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-top: 20px;
  text-align: center;
`;

const StyledError = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #ffcdd2;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.md};
`;

const ffmpeg = createFFmpeg({
  // corePath: `/ffmpeg/ffmpeg-core.js`,
  // I've included a default import above (and files in the public directory), but you can also use a CDN like this:
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  log: true,
});

export const InterviewPage: React.FC<InterviewResponseTypes.InterviewPageProps> = ({ InterviewData, questions, currentQuestionIndex, onNextQuestion, onFinish }) => {


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
    setCountdown(2);
  };

  const startRecording = () => {
    setRecording(true);
    setRecorded(false);
    setError(null);
    setRecordedChunks([]);
    setAnswerTimer(30); // Start the 30-second timer
    const stream = webcamRef.current?.stream;
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current.start();
    }
  };

  const moveToNextQuestion = () => {
    console.log("Currnet question index:", currentQuestionIndex)
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
      setActiveCameraFeed(false);
      setRecording(false);
      setRecorded(true);
      setAnswerTimer(null); // Reset the answer timer
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
        setTimer(2);
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
        formData.append('question2', 'Whats the question');
        formData.append('video', file, `${InterviewData.id}-video-${unique_id}.webm`);
        formData.append('video', file, `${InterviewData.id}-video-${unique_id}.webm`);
        formData.append('audio', output, `${InterviewData.id}-audio-${unique_id}.wav`);
        formData.forEach((value, key) => {
          console.log(key, value);
        });
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
  return (
    <StyledContainer>
      <StyledLeftPanel>
      <>
      <h2>AI Interview</h2>
      <p>
          Question {currentQuestionIndex + 1} of {questions.length}
        </p>
      </>
      </StyledLeftPanel>
    <StyledRightPanel>
      {activeCameraFeed &&  (
        <div>
          <h2>{questions[currentQuestionIndex].name}</h2>
          <p>{questions[currentQuestionIndex].questionValue}</p>
        </div>
      )}
      {activeCameraFeed &&  (
        <StyledVideoContainer>
          <Webcam audio={true} ref={webcamRef} width="100%" height="100%" />
          {countdown !== null && <StyledCountdownOverlay>{countdown}</StyledCountdownOverlay>}
          {answerTimer !== null && <StyledAnswerTimer>Time left: {answerTimer}s</StyledAnswerTimer>}
        </StyledVideoContainer>
      )}
      {recording && (currentQuestionIndex < questions.length) ? (
        <StyledButton onClick={handleStopRecording}>Stop Recording</StyledButton>
      ) : (
        activeCameraFeed &&  (
          <StyledButton onClick={handleStartRecording} disabled={submitting || countdown !== null}>
            {countdown !== null ? 'Starting...' : 'Start Recording'}
          </StyledButton>
        )
      )}
      {submitting && <StyledMessage>Submitting your response...</StyledMessage>}

      {timer !== null &&(
        <>
          <StyledMessage>Response submitted successfully! Moving to next question in:</StyledMessage>
          <StyledTimer>{timer}</StyledTimer>
        </>
      )}
      {error && <StyledError>{error}</StyledError>}
    </StyledRightPanel>
  </StyledContainer>
);
};