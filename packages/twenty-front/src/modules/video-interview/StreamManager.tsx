// StreamManager.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

interface StreamContextType {
  stream: MediaStream | null;
  isStreamReady: boolean;
  error: Error | null;
}

const StreamContext = createContext<StreamContextType>({
  stream: null,
  isStreamReady: false,
  error: null
});

export const StreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initStream = async () => {
      try {
        const videoConstraints = {
          width: 1280,
          height: 720,
          facingMode: "user",
          frameRate: { ideal: 30, max: 30 },
        };

        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints
        });

        // Warm up the stream
        const videoTrack = mediaStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        // Create a hidden video element to start processing the stream
        const warmupVideo = document.createElement('video');
        warmupVideo.style.position = 'absolute';
        warmupVideo.style.opacity = '0';
        warmupVideo.style.pointerEvents = 'none';
        warmupVideo.style.width = '1px';
        warmupVideo.style.height = '1px';
        warmupVideo.srcObject = mediaStream;
        document.body.appendChild(warmupVideo);
        
        await warmupVideo.play();

        // After warm-up period, mark stream as ready
        setTimeout(() => {
          setStream(mediaStream);
          setIsStreamReady(true);
          // Clean up warm-up video
          document.body.removeChild(warmupVideo);
        }, 1000);

      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize stream'));
      }
    };

    initStream();

    // Cleanup
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <StreamContext.Provider value={{ stream, isStreamReady, error }}>
      {children}
    </StreamContext.Provider>
  );
};

export const useStream = () => useContext(StreamContext);