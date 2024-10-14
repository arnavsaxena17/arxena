import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';

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

const StyledSuccessMessage = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.md};
  text-align: center;
`;

const StyledErrorMessage = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.md};
  text-align: center;
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

interface Question {
  id: string;
  name: string;
  questionValue: string;
  timeLimit: number;
}

interface InterviewPageProps {
  questions: Question[];
  currentQuestionIndex: number;
  onNextQuestion: (responseData: FormData) => void;
  onFinish: () => void;
}

export const InterviewPage: React.FC<InterviewPageProps> = ({ questions,currentQuestionIndex, onNextQuestion, onFinish }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
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

  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setRecordedChunks([]);
      setError(null);
      setTimer(null);
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

  const handleStartRecording = () => {
    setRecording(true);
    setRecorded(false);
    setError(null);
    setRecordedChunks([]);
    const stream = webcamRef.current?.stream;
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current.onstop = handleSubmit;
      mediaRecorderRef.current.start();
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setRecorded(true);
  };

  const handleDataAvailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      setRecordedChunks((prev) => [...prev, event.data]);
    }
  };


 const handleSubmit = async () => {
    if (recordedChunks.length) {
      setError(null);
      
      try {
        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const audioBlob = await extractAudioFromVideo(videoBlob);
        const formData = new FormData();
        formData.append('video', videoBlob, 'interview.webm');
        formData.append('audio', audioBlob, 'audio.wav');
        formData.append('aIInterviewQuestionId', questions[currentQuestionIndex].id);
        formData.append('isLastQuestion', (currentQuestionIndex === questions.length - 1).toString());
        
        await onNextQuestion(formData);
        
        setSubmitting(false);
        setTimer(5); // Start 5-second countdown after successful submission
      } catch (error) {
        console.error('Error submitting response:', error);
        setSubmitting(false);
        setError('Failed to submit response. Please try again.');
      }
    }
  };



  useEffect(() => {
    if (submissionStatus === 'success' && timer !== null) {
      if (timer > 0) {
        const timerId = setTimeout(() => setTimer(timer - 1), 1000);
        return () => clearTimeout(timerId);
      } else {
        if (currentQuestionIndex < questions.length - 1) {
          setRecorded(false);
          setFeedback('');
          setError('');
          setTimer(null);
          setRecordedChunks([]);
          setSubmissionStatus('idle');
        } else {
          onFinish();
        }
      }
    }
  }, [submissionStatus, timer, currentQuestionIndex, questions.length, onFinish]);
  
  async function extractAudioFromVideo(videoBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const reader = new FileReader();
  
      reader.onload = async (event) => {
        if (event.target?.result instanceof ArrayBuffer) {
          try {
            const audioBuffer = await audioContext.decodeAudioData(event.target.result);
            const offlineAudioContext = new OfflineAudioContext(
              audioBuffer.numberOfChannels,
              audioBuffer.length,
              audioBuffer.sampleRate
            );
  
            const source = offlineAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineAudioContext.destination);
            source.start();
            const renderedBuffer = await offlineAudioContext.startRendering();
            const wavBlob = bufferToWav(renderedBuffer);
            resolve(wavBlob);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error('Failed to read video file'));
        }
      };
  
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(videoBlob);
    });
  }
  
  function bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const data = new Uint8Array(length);
  
    let offset = 0;
  
    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        data.set(new Uint8Array([str.charCodeAt(i)]), offset + i);
      }
      offset += str.length;
    };
  
    const writeUint16 = (num: number) => {
      data.set(new Uint8Array([num & 0xff, (num >> 8) & 0xff]), offset);
      offset += 2;
    };
  
    const writeUint32 = (num: number) => {
      data.set(new Uint8Array([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, (num >> 24) & 0xff]), offset);
      offset += 4;
    };
    
      // Write WAV header
      writeString('RIFF');
      writeUint32(length - 8);
      writeString('WAVE');
      writeString('fmt ');
      writeUint32(16);
      writeUint16(1);
      writeUint16(numOfChan);
      writeUint32(buffer.sampleRate);
      writeUint32(buffer.sampleRate * 2 * numOfChan);
      writeUint16(numOfChan * 2);
      writeUint16(16);
      writeString('data');
      writeUint32(length - 44);
    
    // Write audio data
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChan; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        writeUint16(int16);
      }
    }
  
    return new Blob([data], { type: 'audio/wav' });
  }
  

  if (!hasCamera) {
    return <StyledError>{error}</StyledError>;
  }

  return (
    <StyledContainer>
      <StyledLeftPanel>
        <h2>AI Interview</h2>
        <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
      </StyledLeftPanel>
      <StyledRightPanel>
        <h2>{questions[currentQuestionIndex].name}</h2>
        <p>{questions[currentQuestionIndex].questionValue}</p>
        <StyledVideoContainer>
          <Webcam
            audio={true}
            ref={webcamRef}
            width="100%"
            height="100%"
          />
        </StyledVideoContainer>
        {recording ? (
          <StyledButton onClick={handleStopRecording}>Stop Recording</StyledButton>
        ) : (
          <StyledButton onClick={handleStartRecording} disabled={submitting}>Start Recording</StyledButton>
        )}
        {submitting && (
          <StyledMessage>Submitting your response...</StyledMessage>
        )}
        {timer !== null && (
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
