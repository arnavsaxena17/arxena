import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import fs from 'fs';
import ReactPlayer from 'react-player';

const StyledContainer = styled.div`
  background-color: red;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const StyledVideoContainer = styled.div`
  background-color: red;
  height: 50%;
  width: 50%;
  background-color: black;
`;

export const Split = () => {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [played, setPlayed] = useState(0);

  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const handleVolumeChange = e => {
    setVolume(parseFloat(e.target.value));
  };

  const handleProgress = state => {
    setPlayed(state.played);
  };

  const videoSource = '/home/aditya058/Arxena/twenty/packages/twenty-server/uploads/70388dc5-f986-4a94-9635-cc49cbb122d3.webm';

  const videoUrl = URL.createObjectURL(videoSource);

  return (
    <StyledContainer>
      <StyledVideoContainer>
        <div className="video-player">
          <ReactPlayer url={url} playing={playing} volume={volume} onProgress={handleProgress} width="100%" height="auto" />
          <div className="controls">
            <button onClick={handlePlayPause}>{playing ? 'Pause' : 'Play'}</button>
            <input type="range" min={0} max={1} step={0.1} value={volume} onChange={handleVolumeChange} />
            <progress max={1} value={played} />
          </div>
        </div>
      </StyledVideoContainer>
    </StyledContainer>
  );
};
