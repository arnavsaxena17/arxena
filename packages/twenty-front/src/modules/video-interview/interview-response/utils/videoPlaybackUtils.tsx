import React, { RefObject, useState, useEffect } from 'react';
import { StyledVideoPane, StyledVideo, StyledLoadingMessage } from './StyledComponents';

interface VideoPlayerProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  isMuted: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
}

const StyledProgressContainer = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: '100%',
  height: '4px',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  zIndex: 20,
  opacity: 1,
};

const StyledProgress = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  height: '100%',
  backgroundColor: '#3b82f6',
  transition: 'width 0.1s linear',
  opacity: 1,
};

const StyledVideoWrapper = {
  position: 'relative' as const,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
};

// Updated control button styles for center positioning
const StyledControlsWrapper = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 30,
  width: '120px', // Larger size
  height: '120px', // Larger size
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'opacity 0.3s ease',
};

// Overlay for showing controls on hover
const StyledOverlay = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  opacity: 0,
  transition: 'opacity 0.3s ease',
  zIndex: 25,
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  videoRef,
  isPlaying,
  isMuted,
  setIsPlaying,
  onLoadStart,
  onCanPlay
}) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  // Start playing the video when it's loaded
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      const playVideo = async () => {
        try {
          videoRef.current!.muted = true;
          await videoRef.current!.play();
          setIsPlaying(true);
          setShowControls(false);
        } catch (error) {
          console.error('Error autoplaying video:', error);
        }
      };
      playVideo();
    }
  }, [videoUrl, videoRef]);

  // Handle video state changes
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.error('Error playing video:', e));
        setShowControls(false);
      } else {
        videoRef.current.pause();
        setShowControls(true);
      }
      videoRef.current.muted = isMuted;
    }
  }, [isPlaying, isMuted]);

  const resetVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setProgress(0);
      setIsPlaying(false);
      setShowControls(true);
    }
  };

  // Download and set up video
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

  // Handle progress updates and video end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        setProgress(percent);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    
    const handleVideoEnd = () => {
      resetVideo();
    };
    video.addEventListener('ended', handleVideoEnd);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('ended', handleVideoEnd);
    };
  }, [videoRef]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      video.play().catch(e => {
        console.error('Error playing video:', e);
        setError('Unable to play video. Please try again.');
      });
      setIsPlaying(true);
      setShowControls(false);
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

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (isPlaying) {
      setShowControls(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (isPlaying) {
      setShowControls(false);
    }
  };

  if (isLoading) {
    return (
      <StyledVideoPane>
        <StyledLoadingMessage>
          Loading video...
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
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 97 97" fill="none">
      <g opacity="0.8">
        <path fillRule="evenodd" clipRule="evenodd" d="M48.5 96.33C75.01 96.33 96.5 74.84 96.5 48.33C96.5 21.82 75.01 0.329956 48.5 0.329956C21.99 0.329956 0.5 21.82 0.5 48.33C0.5 74.84 21.99 96.33 48.5 96.33Z" fill="white"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M37.826 34.152C37.826 31.744 40.521 30.317 42.5131 31.671L63.375 45.849C65.1271 47.039 65.1271 49.621 63.375 50.812L42.5131 64.99C40.521 66.344 37.826 64.918 37.826 62.51V34.152Z" fill="black"/>
      </g>
    </svg>
  );

  const pauseButton = (
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 97 97" fill="none">
      <g opacity="0.8">
        <circle cx="48.5" cy="48.33" r="48" fill="white"/>
        <rect x="34" y="30" width="10" height="36" rx="2" fill="black"/>
        <rect x="53" y="30" width="10" height="36" rx="2" fill="black"/>
      </g>
    </svg>
  );

  return (
    <StyledVideoPane>
      <div 
        style={StyledVideoWrapper} 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handlePlayPause}
      >
        <div style={StyledProgressContainer} onClick={handleProgressClick}>
          <div style={{ ...StyledProgress, width: `${progress}%` }} />
        </div>
        <StyledVideo
          ref={videoRef}
          src={videoUrl || undefined}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}    
          onLoadStart={onLoadStart}
          onCanPlay={onCanPlay}    
          playsInline
          muted
          autoPlay
          loop
          preload="auto"
        />
        <div 
          style={{ 
            ...StyledOverlay, 
            opacity: (showControls || !isPlaying) ? 1 : 0 
          }} 
        />
        <div 
          style={{ 
            ...StyledControlsWrapper,
            opacity: (showControls || !isPlaying) ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none'
          }}
        >
          {isPlaying ? pauseButton : playButton}
        </div>
      </div>
    </StyledVideoPane>
  );
};