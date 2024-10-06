import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import Webcam from 'react-webcam';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import fs from 'fs';

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
