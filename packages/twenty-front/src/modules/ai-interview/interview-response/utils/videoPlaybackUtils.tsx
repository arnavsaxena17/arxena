import React, { RefObject, useState, useEffect } from 'react';
import { StyledVideoPane, StyledVideo, StyledVideoControls, StyledVideoButton, StyledLoadingMessage } from './StyledComponents';

interface VideoPlayerProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}


const StyledProgressContainer = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: '100%',
  height: '4px',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  zIndex: 20, // Increased z-index
  opacity: 1, // Ensure visibility
};

const StyledProgress = {
  position: 'absolute' as const, // Added position absolute
  top: 0,
  left: 0,
  height: '100%',
  backgroundColor: '#3b82f6',
  transition: 'width 0.1s linear',
  opacity: 1, // Ensure visibility
};

// New wrapper style to ensure proper positioning context
const StyledVideoWrapper = {
  position: 'relative' as const,
  width: '100%',
  height: '100%',
};


export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, videoRef, isPlaying, setIsPlaying }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  // Reset video and progress when playback stops
  
  
  const resetVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setProgress(0);
      setIsPlaying(false);
    }
  };


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
        setError('Loading video...');
        setIsLoading(false);
      }
    };

    downloadVideo();

    return () => {
      abortController.abort();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [src]);

  // useEffect(() => {
  //   const video = videoRef.current;
  //   if (!video) return;

  //   const updateProgress = () => {
  //     if (video.duration) {
  //       const percent = (video.currentTime / video.duration) * 100;
  //       setProgress(percent);
  //     }
  //   };

  //   if (isPlaying) {
  //     // Update progress immediately when starting playback
  //     updateProgress();
  //     const interval = setInterval(updateProgress, 100); // Update every 100ms
  //     video.addEventListener('timeupdate', updateProgress);
      
  //     return () => {
  //       clearInterval(interval);
  //       video.removeEventListener('timeupdate', updateProgress);
  //     };
  //   }
  // }, [isPlaying, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        setProgress(percent);
      }
    };

    // Handle progress updates
    video.addEventListener('timeupdate', updateProgress);
    
    // Handle video end
    const handleVideoEnd = () => {
      resetVideo();
    };
    video.addEventListener('ended', handleVideoEnd);

    if (isPlaying) {
      // Update progress immediately when starting playback
      updateProgress();
      const interval = setInterval(updateProgress, 100); // Update every 100ms
      video.addEventListener('timeupdate', updateProgress);
      
      return () => {
        clearInterval(interval);
        video.removeEventListener('timeupdate', updateProgress);
      };
    }

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('ended', handleVideoEnd);
    };
  }, [isPlaying, videoRef]);




  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPlaying) {
      resetVideo();
    }

  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPlaying && video.currentTime === 0) {
      setProgress(0);
    }
  }, [isPlaying]);


  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (video.muted) {
        video.muted = false;
      }
      video.play().catch(e => {
        console.error('Error playing video:', e);
        setError('Unable to play video. Please try again.');
      });
      setIsPlaying(true);
    }
  };





  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    
    video.currentTime = clickPosition * video.duration;
    setProgress(clickPosition * 100);
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

  return (
    <StyledVideoPane>
      <div style={StyledVideoWrapper}>
        <div style={StyledProgressContainer} onClick={handleProgressClick}>
          <div style={{ ...StyledProgress, width: `${progress}%` }} />
        </div>
        <StyledVideo
          ref={videoRef}
          src={videoUrl || undefined}
          onEnded={() => setIsPlaying(false)}
          playsInline
          muted
          autoPlay
          loop
        />
        <StyledVideoControls>
          <StyledVideoButton onClick={handlePlayPause}>
            {isPlaying ? '⏹' : playButton}
          </StyledVideoButton>
        </StyledVideoControls>
      </div>
    </StyledVideoPane>
  );
};
