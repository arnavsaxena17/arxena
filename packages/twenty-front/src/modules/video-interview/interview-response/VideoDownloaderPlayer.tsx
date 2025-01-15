import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';

interface VideoDownloaderPlayerProps {
  videoUrl: string;
}

const VideoDownloaderPlayer: React.FC<VideoDownloaderPlayerProps> = ({ videoUrl }) => {
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const downloadVideo = async () => {
      try {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        setLocalVideoUrl(localUrl);
      } catch (err) {
        console.error('Error downloading video:', err);
        setError('Failed to download video. Please try again.');
      }
    };

    downloadVideo();

    // Cleanup function to revoke the object URL
    return () => {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [videoUrl]);

  if (error) {
    return <div>{error}</div>;
  }

  if (!localVideoUrl) {
    return <div>Downloading video...</div>;
  }

  return (
    <ReactPlayer
      url={localVideoUrl}
      controls
      muted={true}
      playsinline
      width="100%"
      height="auto"
      onError={(e) => {
        console.error('ReactPlayer error:', e);
        setError('Error playing video. Please try again.');
      }}
    />
  );
};

export default VideoDownloaderPlayer;