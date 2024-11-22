import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import VideoDownloaderPlayer from './VideoDownloaderPlayer';

const StyledContainer = styled.div`
  background-color: red;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const StyledVideoContainer = styled.div`
  background-color: black;
  height: 50%;
  width: 50%;
`;

const DebugInfo = styled.div`
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  margin-top: 10px;
  border-radius: 5px;
  font-family: monospace;
`;

const VideoInterviewResponseViewer: React.FC<{ interviewId: string }> = ({ interviewId }) => {
  console.log("Want to view VIdoe INterview Response Here::", interviewId)
  console.log("interviewId::", interviewId)
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [played, setPlayed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading');
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  const videoUrl = `http://localhost:3000/files/attachment/be359b56-4af0-422a-897f-ddb91426ceda.webm?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmF0aW9uX2RhdGUiOiIyMDI0LTEwLTE1VDE0OjU1OjEwLjA2N1oiLCJhdHRhY2htZW50X2lkIjoiM2JlYjYwZTgtNDkwNS00MWI1LTg0NmItY2I4MTYyZjQyY2FkIiwiaWF0IjoxNzI4OTE3NzEwLCJleHAiOjE3MjkwOTc3MTB9.cOwb3mpzRHvXb1HsZsP1jSJIuGFxDEfsEinxX3CIR9k`;

  useEffect(() => {
    const checkVideoAvailability = async () => {
      try {
        const response = await fetch(videoUrl, { method: 'HEAD' });
        if (!response.ok) {
          setError(`Video not accessible. Status: ${response.status}`);
        } else {
          setStatus('Video accessible');
          setDebugInfo(prev => ({ ...prev, headers: Object.fromEntries(response.headers) }));
        }
      } catch (err) {
        setError(`Error checking video: ${(err as Error).message}`);
      }
    };

    checkVideoAvailability();
  }, [videoUrl]);

  const handlePlayPause = () => setPlaying(!playing);
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e.target.value));
  const handleProgress = (state: { played: number }) => setPlayed(state.played);
console.log("videoUrl::", videoUrl)
  return (
    <StyledContainer>
      <StyledVideoContainer>
        <VideoDownloaderPlayer videoUrl={videoUrl} />
      </StyledVideoContainer>
      <DebugInfo>
        <div>Status: {status}</div>
        {error && <div style={{color: 'red'}}>Error: {JSON.stringify(error)}</div>}
        <div>Interview ID: {interviewId}</div>
        <div>Debug Info: {JSON.stringify(debugInfo, null, 2)}</div>
      </DebugInfo>
    </StyledContainer>
  );
};

export default VideoInterviewResponseViewer;