import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
// @ts-ignore
import Webcam from 'react-webcam'; 
// @ts-ignore
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import fs from 'fs';

const StyledContainer = styled.div`
  background-color: white;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const StyledWebcamContainer = styled.div`
  background-color: white;
  height: 50%;
  width: 50%;
  background-color: black;
`;

const questions = [
  {
    id: 1,
    name: 'Behavioral',
    description: 'From LinkedIn, Amazon, Adobe',
    difficulty: 'Easy',
  },
  {
    id: 2,
    name: 'Technical',
    description: 'From Google, Meta, and Apple',
    difficulty: 'Medium',
  },
];

const interviewers = [
  {
    id: 'John',
    name: 'John',
    description: 'Software Engineering',
    level: 'L3',
  },
  {
    id: 'Richard',
    name: 'Richard',
    description: 'Product Management',
    level: 'L5',
  },
  {
    id: 'Sarah',
    name: 'Sarah',
    description: 'Other',
    level: 'L7',
  },
];

const ffmpeg = createFFmpeg({
  // corePath: `/ffmpeg/ffmpeg-core.js`,
  // I've included a default import above (and files in the public directory), but you can also use a CDN like this:
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  log: true,
});

export const VideoInterviewResponsePage = () => {
  const [selected, setSelected] = useState(questions[0]);
  const [selectedInterviewer, setSelectedInterviewer] = useState(interviewers[0]);
  const webcamRef = useRef<Webcam | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [seconds, setSeconds] = useState(600);
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('Processing');
  const [isSuccess, setIsSuccess] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [generatedFeedback, setGeneratedFeedback] = useState('');
  const [completed, setCompleted] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [cameraLoaded, setCameraLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
  }, []);

  const handleStartCaptureClick = () => {
    setCapturing(true);
    mediaRecorderRef.current = new MediaRecorder(webcamRef?.current?.stream as MediaStream);
    mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
    mediaRecorderRef.current.start();
  };

  const handleDataAvailable = (event: BlobEvent) => {
    console.log(event.data.size);

    if (event.data.size > 0) {
      setRecordedChunks(prev => prev.concat(event.data));
    }
  };

  const handleStopCaptureClick = () => {
    mediaRecorderRef.current?.stop();
    setCapturing(false);
  };

  useEffect(() => {
    let timer: any = null;
    if (capturing) {
      timer = setInterval(() => {
        setSeconds(seconds => seconds - 1);
      }, 1000);
      if (seconds === 0) {
        handleStopCaptureClick();
        setCapturing(false);
        setSeconds(0);
      }
    }
    return () => {
      clearInterval(timer);
    };
  });

  const handleDownload = async () => {
    if (recordedChunks.length) {
      setSubmitting(true);
      setStatus('Processing');

      const file = new Blob(recordedChunks, {
        type: `video/webm`,
      });

      setRecordedChunks([]);

      const unique_id = uuid();

      // This checks if ffmpeg is loaded
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      // This writes the file to memory, removes the video, and converts the audio to mp3
      ffmpeg.FS('writeFile', `${unique_id}.webm`, await fetchFile(file));
      await ffmpeg.run('-i', `${unique_id}.webm`, '-vn', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '16000', `${unique_id}.wav`);
      // This reads the converted file from the file system
      const fileData = ffmpeg.FS('readFile', `${unique_id}.wav`);

      const fileDataBlob = new Blob([fileData.buffer], {
        type: 'audio/wav',
      });

      // This creates a new file from the raw data
      // const output = new File([fileDataBlob], `${unique_id}.wav`, {
      //   type: 'audio/wav',
      // });

      const output = new Blob([fileData], {
        type: 'audio/wav',
      });

      const formData = new FormData();
      formData.append('operations', '{}');
      formData.append('map', '{}');
      formData.append('model', 'whisper-12');
      formData.append('question2', 'Whats the question');
      formData.append('video', file, `${unique_id}.webm`);
      formData.append('video', file, `${unique_id}.webm`);
      formData.append('audio', output, `${unique_id}.wav`);

      formData.forEach((value, key) => {
        console.log(key, value);
      });

      const question =
        selected.name === 'Behavioral'
          ? `Tell me about yourself. Why don${`’`}t you walk me through your resume?`
          : selectedInterviewer.name === 'John'
            ? 'What is a Hash Table, and what is the average case and worst case time for each of its operations?'
            : selectedInterviewer.name === 'Richard'
              ? 'Uber is looking to expand its product line. Talk me through how you would approach this problem.'
              : 'You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?';

      setStatus('Transcribing');

      const upload = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}'/video-interview/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => {
        console.log(res);
        return res;
      });

      const results = upload.data;

      console.log(results);

      if (upload) {
        setIsSuccess(true);
        setSubmitting(false);

        if (results.error) {
          setTranscript(results.error);
        } else {
          setTranscript(results.transcript);
        }

        console.log('Uploaded successfully!');

        await Promise.allSettled([new Promise(resolve => setTimeout(resolve, 800))]).then(() => {
          setCompleted(true);
          console.log('Success!');
        });

        if (results.transcript.length > 0) {
          const prompt = `Please give feedback on the following interview question: ${question} given the following transcript: ${results.transcript}. ${
            selected.name === 'Behavioral'
              ? "Please also give feedback on the candidate's communication skills. Make sure their response is structured (perhaps using the STAR or PAR frameworks)."
              : "Please also give feedback on the candidate's communication skills. Make sure they accurately explain their thoughts in a coherent way. Make sure they stay on topic and relevant to the question."
          } \n\n\ Feedback on the candidate's response:`;

          setGeneratedFeedback('');
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt,
            }),
          });

          if (!response.ok) {
            throw new Error(response.statusText);
          }

          // This data is a ReadableStream
          const data = response.body;
          if (!data) {
            return;
          }

          const reader = data.getReader();
          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            const chunkValue = decoder.decode(value);
            setGeneratedFeedback((prev: any) => prev + chunkValue);
          }

          console.log(generatedFeedback);
        }
      } else {
        console.error('Upload failed.');
      }

      setTimeout(() => {
        setRecordedChunks([]);
      }, 1500);
    }
  };

  const restartVideo = () => {
    setRecordedChunks([]);
    setVideoEnded(false);
    setCapturing(false);
    setIsVisible(true);
    setSeconds(150);
  };

  const videoConstraints = isDesktop ? { width: 1280, height: 720, facingMode: 'user' } : { width: 480, height: 640, facingMode: 'user' };

  const handleUserMedia = () => {
    setTimeout(() => {
      setLoading(false);
      setCameraLoaded(true);
    }, 1000);
  };

  return (
    <StyledContainer>
      <StyledWebcamContainer>
        <Webcam style={{ objectFit: 'cover' }} width={'100%'} height={'100%'} ref={webcamRef} mirrored audio muted />
        {capturing ? <button onClick={handleStopCaptureClick}>Stop Capture</button> : <button onClick={handleStartCaptureClick}>Start Capture</button>}
        <button onClick={handleDownload}>Download</button>
      </StyledWebcamContainer>
    </StyledContainer>
  );
};
