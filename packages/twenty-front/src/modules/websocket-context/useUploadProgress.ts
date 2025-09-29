import { tokenPairState } from '@/auth/states/tokenPairState';
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

export interface UploadProgressData {
  step: string;
  message: string;
  progress_percentage?: number;
  total_candidates?: number;
  processed_candidates?: number;
  current_batch?: number;
  total_batches?: number;
  timestamp: string;
}

export const useUploadProgress = () => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const tokenPair = useRecoilValue(tokenPairState);

  useEffect(() => {
    if (!tokenPair?.accessToken?.token) {
      console.warn('No access token available for upload progress streaming');
      return;
    }

    // Clean up any existing connection
    if (eventSourceRef.current) {
      console.log('🧹 Cleaning up existing SSE connection before creating new one');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Note: EventSource doesn't support custom headers, so we pass token as query parameter
    const url = new URL(`${process.env.REACT_APP_SERVER_BASE_URL}/upload-progress/stream`);
    url.searchParams.set('token', tokenPair.accessToken.token);
    url.searchParams.set('origin', window.location.origin);
    console.log('🔗 Connecting to SSE endpoint:', url.toString());
    console.log('🔗 Token available:', !!tokenPair.accessToken.token);
    console.log('🔗 Origin:', window.location.origin);
    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ Upload progress SSE connection opened');
      console.log('✅ EventSource readyState:', eventSource.readyState);
      console.log('✅ EventSource URL:', eventSource.url);
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('📨 Raw SSE event data:', event.data);
        
        // Extract JSON from SSE format (remove "data: " prefix)
        let jsonData = event.data;
        if (jsonData.startsWith('data: ')) {
          jsonData = jsonData.substring(6); // Remove "data: " prefix
        }
        
        const data = JSON.parse(jsonData);
        console.log('📨 Received upload progress data:', data);
        console.log('📨 EventSource readyState after message:', eventSource.readyState);
        console.log('📨 EventSource URL after message:', eventSource.url);
        
        // Skip heartbeat messages
        if (data.step === 'heartbeat') {
          console.log('💓 Heartbeat received, keeping connection alive');
          return;
        }
        
        setUploadProgress(data);
      } catch (parseError) {
        console.error('❌ Failed to parse upload progress data:', parseError);
        console.error('❌ Raw data that failed to parse:', event.data);
        setError('Failed to parse progress data');
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ Upload progress SSE connection error:', error);
      console.error('❌ EventSource readyState:', eventSource.readyState);
      console.error('❌ EventSource URL:', eventSource.url);
      console.error('❌ Error type:', error.type);
      console.error('❌ Error target:', error.target);
      setIsConnected(false);
      setError('Connection error');
      
      // Don't automatically reconnect - let the user manually reconnect if needed
      // This prevents the connection from being recreated too frequently
      console.log('❌ SSE connection error - manual reconnection required');
    };

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up SSE connection - useEffect cleanup triggered');
      console.log('🧹 EventSource readyState before close:', eventSource.readyState);
      console.log('🧹 EventSource URL before close:', eventSource.url);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [tokenPair?.accessToken?.token]); // Removed connectionAttempts from dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 useUploadProgress hook unmounting - closing EventSource');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    uploadProgress,
    isConnected,
    error,
    reconnect: () => {
      console.log('🔄 Manual reconnect triggered');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setError(null);
      // Force a re-render to trigger the useEffect
      setUploadProgress(null);
    }
  };
};
