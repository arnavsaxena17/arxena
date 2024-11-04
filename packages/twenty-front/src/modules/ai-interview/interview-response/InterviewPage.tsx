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
  StyledCountdownOverlay,
  StyledMessage,
  StyledTimer,
  StyledError,
  SnapScrollContainer,
  StyledLeftPanel,
  StyledRightPanel,
} from './styled-components/StyledComponentsInterviewResponse';

import { Mixpanel } from '~/mixpanel'

const ffmpeg = createFFmpeg({
  // corePath: `/ffmpeg/ffmpeg-core.js`,
  // I've included a default import above (and files in the public directory), but you can also use a CDN like this:
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  log: true,
});


const PreloadVideo: React.FC<{ src: string }> = ({ src }) => (
  <link rel="preload" as="video" href={src} />
);


interface InterviewPageProps extends InterviewResponseTypes.InterviewPageProps {
  videoPlaybackState: { isPlaying: boolean; isMuted: boolean };
  onVideoStateChange: (state: { isPlaying: boolean; isMuted: boolean }) => void;
}

export const InterviewPage: React.FC<InterviewPageProps> = ({ InterviewData, questions, introductionVideoAttachment, questionsVideoAttachment, currentQuestionIndex, onNextQuestion, onFinish, videoPlaybackState, onVideoStateChange }) => {
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
  const interviewTime = 240; // 4 minutes
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [nextQuestionVideoUrl, setNextQuestionVideoUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [preloadedVideos, setPreloadedVideos] = useState<Record<string, boolean>>({});

  const handlePlaybackChange = (isPlaying: boolean) => {
    onVideoStateChange({
      ...videoPlaybackState,
      isPlaying
    });
  };

  // Function to get video URL for a specific question index
  const getQuestionVideoURL = (index: number) => {
    const attachment = questionsVideoAttachment.find(
      attachment => attachment?.id === questions[index]?.attachments?.edges[0]?.node?.id
    )?.fullPath;
    return attachment ? `${process.env.REACT_APP_SERVER_BASE_URL}/files/${attachment}` : null;
  };

  // Preload next question's video
  useEffect(() => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextVideoUrl = getQuestionVideoURL(currentQuestionIndex + 1);
      setNextQuestionVideoUrl(nextVideoUrl);
    }
  }, [currentQuestionIndex, questions, questionsVideoAttachment]);

  
  // Handle video loading state
  const handleVideoLoadStart = () => {
    setIsVideoLoading(true);
  };

  const handleVideoCanPlay = () => {
    setIsVideoLoading(false);
  };

  useEffect(() => {
    checkCamera();
  }, []);

  // In your component:
  useEffect(() => {
    if (InterviewData?.candidate?.id) {
      Mixpanel.identify(InterviewData.candidate.id);
      Mixpanel.track('Interview Page View', {
        jobTitle: InterviewData?.candidate?.jobs?.name,
        company: InterviewData?.candidate?.jobs?.companyName,
        questionCount: questions.length
      });
    }
  }, [InterviewData]);
  

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
    resetAndStopVideo(); 
    setCountdown(5);
    setRecording(true);
  };

  const startRecording = () => {
    setRecording(true);
    setRecorded(false);
    setError(null);
    setRecordedChunks([]);
    setAnswerTimer(interviewTime);
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
      setIsVideoLoading(true);

      setRecordedChunks([]);
      setError(null);
      setTimer(null);
      setActiveCameraFeed(true);
      setRecording(false);
      setRecorded(false);
      setSubmitting(false);
      setCountdown(null);
      setAnswerTimer(null);
      if (videoRef.current) {
        videoRef.current.load();
      }

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

  // At the top of your file:
  // const currentQuestionVideoURL = getQuestionVideoURL(currentQuestionIndex);

  console.log('Current question interview attachment: for question index:', currentQuestionIndex);
  console.log('Current question interview questionsVideoAttachment:', questionsVideoAttachment);
  const currentQuestionInterviewAttachment = questionsVideoAttachment.find(attachment => attachment?.id === questions[currentQuestionIndex]?.attachments?.edges[0]?.node?.id)?.fullPath;
  const currentQuestionVideoURL = getQuestionVideoURL(currentQuestionIndex);
  console.log('This is the currentQuestionVideoURL::', currentQuestionVideoURL);

  return (
    <SnapScrollContainer>
      <StyledLeftPanel>
      <h2>{InterviewData?.candidate?.jobs?.name} at {InterviewData?.candidate?.jobs?.companyName}</h2>
      {/* <h2>Group Manufacturing Head at Luthra Group LLP</h2> */}
        <StyledLeftPanelContentBox>
          <StyledTextLeftPanelTextHeadline>
            Question {currentQuestionIndex + 1} of {questions.length}
          </StyledTextLeftPanelTextHeadline>
          <VideoPlayer 
            src={currentQuestionVideoURL || ''} 
            videoRef={videoRef} 
            isPlaying={videoPlaybackState.isPlaying} 
            setIsPlaying={handlePlaybackChange}
            isMuted={videoPlaybackState.isMuted}
            onLoadStart={handleVideoLoadStart} 
            onCanPlay={handleVideoCanPlay} 
          />
          <h3>Question</h3>
          <StyledTextLeftPaneldisplay>{questions[currentQuestionIndex].questionValue}</StyledTextLeftPaneldisplay>
        </StyledLeftPanelContentBox>
      </StyledLeftPanel>
      <StyledRightPanel>
        <div>
          <h2>Question {currentQuestionIndex + 1} of {questions.length}</h2>
          <p>{questions[currentQuestionIndex].questionValue}</p>
        </div>
        {activeCameraFeed && (
          <VideoContainer answerTimer={answerTimer} isRecording={recording} onRecordingClick={recording ? handleStopRecording : handleStartRecording} setIsPlaying={setIsPlaying} countdown={countdown} webcamRef={webcamRef} interviewTime={interviewTime}></VideoContainer>
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
