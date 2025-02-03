// StreamManager.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface StreamContextType {
    stream: MediaStream | null;
    isStreamReady: boolean;
    error: Error | null;
    getWarmedUpRecorder: () => MediaRecorder | null;
  }
  

const StreamContext = createContext<StreamContextType>({
    stream: null,
    isStreamReady: false,
    error: null,
    getWarmedUpRecorder: function (): MediaRecorder | null {
        throw new Error('Function not implemented.');
    }
});

export const StreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
    // Function to create and warm up a new MediaRecorder
    const createAndWarmRecorder = async (stream: MediaStream) => {
      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm',
          videoBitsPerSecond: 1000000
        });
  
        // Do a quick test recording to warm up the encoder
        recorder.start();
        await new Promise(resolve => setTimeout(resolve, 100)); // Record for 100ms
        recorder.stop();
  
        return recorder;
      } catch (err) {
        console.error('Failed to create MediaRecorder:', err);
        return null;
      }
    };
  
    const getWarmedUpRecorder = () => {
      if (stream && !mediaRecorderRef.current) {
        // Create new recorder if needed
        createAndWarmRecorder(stream).then(recorder => {
          mediaRecorderRef.current = recorder;
        });
      }
      return mediaRecorderRef.current;
    };
  
    useEffect(() => {
      const initStream = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: 1280,
              height: 720,
              facingMode: "user",
              frameRate: { ideal: 30, max: 30 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100
            }
          });
  
          setStream(mediaStream);
          
          // Pre-warm the MediaRecorder
          const recorder = await createAndWarmRecorder(mediaStream);
          mediaRecorderRef.current = recorder;
          
          setIsStreamReady(true);
  
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to initialize stream'));
        }
      };
  
      initStream();
  
      return () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }, []);
  
    return (
      <StreamContext.Provider value={{ stream, isStreamReady, error, getWarmedUpRecorder }}>
        {children}
      </StreamContext.Provider>
    );
  };
  
  

export const useStream = () => useContext(StreamContext);