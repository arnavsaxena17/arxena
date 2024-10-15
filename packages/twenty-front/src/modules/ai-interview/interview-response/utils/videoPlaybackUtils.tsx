import React, { RefObject, useState, useEffect } from 'react';
import styled from '@emotion/styled';

// Styled components remain the same
export const StyledVideoPane = styled.div`
  height: 300px;
  align-self: stretch;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
`;

export const StyledVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const StyledVideoControls = styled.div`
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
`;

export const StyledVideoButton = styled.button`
  background-color: rgba(255, 255, 255, 0.7);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover {
    background-color: rgba(255, 255, 255, 0.9);
  }
`;

const StyledLoadingMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 5px;
`;

// Utility functions for video playback
export const handlePlayPause = (
  videoRef: RefObject<HTMLVideoElement>,
  isPlaying: boolean,
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
): void => {
  if (videoRef.current) {
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }
};

export const handleReplay = (
  videoRef: RefObject<HTMLVideoElement>,
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
): void => {
  if (videoRef.current) {
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  }
};

// React component for video player
interface VideoPlayerProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, videoRef, isPlaying, setIsPlaying }) => {
  const [videoBlob, setVideoBlob] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const downloadVideo = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        setVideoBlob(videoUrl);
        setIsLoading(false);
      } catch (err) {
        console.error('Error downloading video:', err);
        setError('Failed to load video. Please try again.');
        setIsLoading(false);
      }
    };

    downloadVideo();

    // Cleanup function to revoke the blob URL when component unmounts
    return () => {
      if (videoBlob) {
        URL.revokeObjectURL(videoBlob);
      }
    };
  }, [src]);

  if (isLoading) {
    return (
      <StyledVideoPane>
        <StyledLoadingMessage>Loading video...</StyledLoadingMessage>
      </StyledVideoPane>
    );
  }

  if (error) {
    return (
      <StyledVideoPane>
        <StyledLoadingMessage>{error}</StyledLoadingMessage>
      </StyledVideoPane>
    );
  }

  return (
    <StyledVideoPane>
      <StyledVideo
        ref={videoRef}
        src={videoBlob || undefined}
        onEnded={() => setIsPlaying(false)}
      />
      <StyledVideoControls>
        <StyledVideoButton onClick={() => handlePlayPause(videoRef, isPlaying, setIsPlaying)}>
          {isPlaying ? '⏸' : '▶️'}
        </StyledVideoButton>
        <StyledVideoButton onClick={() => handleReplay(videoRef, setIsPlaying)}>
          🔁
        </StyledVideoButton>
      </StyledVideoControls>
    </StyledVideoPane>
  );
};