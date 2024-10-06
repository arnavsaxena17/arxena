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

const StyledWebcamContainer = styled.div`
  background-color: red;
  height: 50%;
  width: 50%;
  background-color: black;
`;

const split = () => {
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
