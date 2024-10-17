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
  const [shouldAutoplay, setShouldAutoplay] = useState<boolean>(true);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      if (shouldAutoplay) {
        video.play().then(() => {
          setIsPlaying(true);
          setShouldAutoplay(false);
        }).catch((error) => {
          console.error('Autoplay failed:', error);
          setShouldAutoplay(false);
        });
      }
    };

    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoRef, shouldAutoplay, setIsPlaying]);

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
  const playButton = (
    <svg xmlns="http://www.w3.org/2000/svg" width="97" height="97" viewBox="0 0 97 97" fill="none">
      <g opacity="0.8">
        <path fillRule="evenodd" clipRule="evenodd" d="M48.5 96.33C75.01 96.33 96.5 74.84 96.5 48.33C96.5 21.82 75.01 0.329956 48.5 0.329956C21.99 0.329956 0.5 21.82 0.5 48.33C0.5 74.84 21.99 96.33 48.5 96.33Z" fill="white"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M37.826 34.152C37.826 31.744 40.521 30.317 42.5131 31.671L63.375 45.849C65.1271 47.039 65.1271 49.621 63.375 50.812L42.5131 64.99C40.521 66.344 37.826 64.918 37.826 62.51V34.152Z" fill="black"/>
      </g>
    </svg>
  );

  const replayButton = <svg fill="#000000" height="200px" width="200px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 490.89 490.89"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="XMLID_231_"> <path id="XMLID_233_" d="M97.38,292.692V181.229c0-24.324,19.792-44.125,44.134-44.125h170.733v19.506 c0,5.525,3.065,10.59,7.941,13.162c4.884,2.59,10.786,2.229,15.343-0.885l100.888-69.057c3.607-2.475,5.771-6.557,5.788-10.934 c0.015-4.377-2.124-8.49-5.722-10.965L335.63,7.956c-4.548-3.146-10.483-3.508-15.383-0.949c-4.91,2.557-7.975,7.653-7.975,13.178 v19.539H141.515C63.483,39.724,0,103.208,0,181.229v111.463c0,26.881,21.801,48.684,48.689,48.684 C75.58,341.376,97.38,319.573,97.38,292.692z"></path> <path id="XMLID_232_" d="M442.199,149.513c-26.891,0-48.691,21.801-48.691,48.701V309.64c0,24.342-19.793,44.143-44.134,44.143 H178.641v-19.506c0-5.523-3.065-10.588-7.941-13.162c-4.884-2.572-10.786-2.23-15.343,0.887L54.468,391.056 c-3.606,2.477-5.771,6.572-5.786,10.951c-0.017,4.359,2.122,8.475,5.72,10.965l100.856,69.961 c4.548,3.147,10.482,3.504,15.384,0.965c4.908-2.572,7.974-7.654,7.974-13.195v-19.539h170.756 c78.031,0,141.516-63.498,141.516-141.523V198.214C490.89,171.313,469.088,149.513,442.199,149.513z"></path> </g> </g></svg>

  return (
    <StyledVideoPane>
      <StyledVideo
        ref={videoRef}
        src={videoUrl || undefined}
        onEnded={() => setIsPlaying(false)}
      />
      <StyledVideoControls>
        <StyledVideoButton onClick={handlePlayPause}>
          {isPlaying ? '⏸' : playButton}
        </StyledVideoButton>
        
      </StyledVideoControls>
    </StyledVideoPane>
  );
};