import React, { RefObject, useState, useEffect } from 'react';
import { StyledVideoPane, StyledVideo, StyledVideoControls, StyledVideoButton, StyledLoadingMessage } from './StyledComponents';

interface VideoPlayerProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, videoRef, isPlaying, setIsPlaying }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const downloadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(src, { signal });
        if (!response.ok) throw new Error('Network response was not ok');

        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          setDownloadProgress(total ? (loaded / total) * 100 : 0);
        }

        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setIsLoading(false);
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        console.error('Error downloading video:', err);
        setError('Failed to load video. Please try again.');
        setIsLoading(false);
      }
    };

    downloadVideo();

    return () => {
      abortController.abort();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [src]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(e => {
          console.error('Error playing video:', e);
          setError('Unable to play video. Please try again.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleReplay = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(e => {
        console.error('Error replaying video:', e);
        setError('Unable to replay video. Please try again.');
      });
      setIsPlaying(true);
    }
  };

  if (isLoading) {
    return (
      <StyledVideoPane>
        <StyledLoadingMessage>
          Loading video... {downloadProgress.toFixed(0)}%
        </StyledLoadingMessage>
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
        src={videoUrl || undefined}
        onEnded={() => setIsPlaying(false)}
      />
      <StyledVideoControls>
        <StyledVideoButton onClick={handlePlayPause}>
          {isPlaying ? '⏸' : '▶️'}
        </StyledVideoButton>
        <StyledVideoButton onClick={handleReplay}>
          🔁
        </StyledVideoButton>
      </StyledVideoControls>
    </StyledVideoPane>
  );
};