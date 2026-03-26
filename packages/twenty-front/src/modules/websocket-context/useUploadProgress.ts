import { tokenPairState } from '@/auth/states/tokenPairState';
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { uploadProgressSseSessionCountState } from './states/uploadProgressSseSessionCountState';

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
  const uploadProgressSessionCount = useRecoilValue(uploadProgressSseSessionCountState);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 2; // Reduce max attempts to prevent excessive reconnections
  const baseReconnectDelay = 5000; // Increase base delay to 5 seconds
  const lastReconnectTimeRef = useRef<number>(0);
  const lastTokenRef = useRef<string | null>(null);
  const lastTokenPairRef = useRef<any>(null);

  useEffect(() => {
    const currentToken = tokenPair?.accessToken?.token;
    const tokenChanged = lastTokenRef.current !== currentToken;
    const tokenPairChanged = lastTokenPairRef.current !== tokenPair;
    const shouldConnect =
      uploadProgressSessionCount > 0 && !!tokenPair?.accessToken?.token;

    console.log('🔄 useUploadProgress useEffect triggered', {
      hasToken: !!currentToken,
      uploadProgressSessionCount,
      shouldConnect,
      tokenPreview: currentToken?.substring(0, 20) + '...',
      isConnected: eventSourceRef.current?.readyState,
      reconnectAttempts: reconnectAttemptsRef.current,
      tokenChanged,
      lastToken: lastTokenRef.current?.substring(0, 20) + '...',
      tokenPairChanged,
      sameTokenValue: lastTokenRef.current === currentToken,
    });

    if (!shouldConnect) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Check if we already have a working connection and token hasn't changed
    if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN && !tokenChanged) {
      console.log('✅ SSE connection already exists and is open, skipping recreation');
      lastTokenPairRef.current = tokenPair;
      return;
    }

    // If token value is the same but object reference changed, don't recreate connection
    if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN && 
        lastTokenRef.current === currentToken && currentToken) {
      console.log('✅ Token value unchanged, keeping existing connection');
      lastTokenPairRef.current = tokenPair;
      return;
    }

    // Clean up any existing connection
    if (eventSourceRef.current) {
      console.log('🧹 Cleaning up existing SSE connection before creating new one');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset reconnect attempts when creating a new connection
    reconnectAttemptsRef.current = 0;
    lastReconnectTimeRef.current = 0;
    lastTokenRef.current = currentToken || null;
    lastTokenPairRef.current = tokenPair;
    
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
      console.log('✅ Upload progress SSE connection opened', 'eventSource', eventSource);
      setIsConnected(true);
      setError(null);
      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        // Extract JSON from SSE format (remove "data: " prefix)
        let jsonData = event.data;
        if (jsonData.startsWith('data: ')) {
          jsonData = jsonData.substring(6); // Remove "data: " prefix
        }
        
        const data = JSON.parse(jsonData);
        
        // Skip heartbeat messages early to avoid unnecessary processing
        if (data.step === 'heartbeat') {
          // Heartbeats don't require state updates, so we skip them entirely
          return;
        }
        
        // Only log and update state for actual progress updates
        console.log('📨 Received upload progress data:', data);
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
      
      // Only attempt reconnection if we haven't exceeded max attempts and enough time has passed
      const now = Date.now();
      const timeSinceLastReconnect = now - lastReconnectTimeRef.current;
      const minReconnectInterval = 10000; // Minimum 10 seconds between reconnection attempts
      
      if (reconnectAttemptsRef.current < maxReconnectAttempts && timeSinceLastReconnect > minReconnectInterval) {
        reconnectAttemptsRef.current++;
        lastReconnectTimeRef.current = now;
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff
        console.log(`🔄 SSE connection error - attempting auto-reconnect ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Auto-reconnecting SSE...');
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
          }
          // Don't call setUploadProgress(null) here as it causes unnecessary rerenders
          // The useEffect will automatically re-run when the token changes or component remounts
          // Just clear the error state to allow reconnection
          setError(null);
        }, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. Manual reconnection required.');
        // Don't set an error message that suggests page refresh - this might trigger reloads
        setError('Connection failed after multiple attempts. Upload progress unavailable.');
      } else {
        console.log('⏳ Skipping reconnection attempt - too soon since last attempt');
        setError('Connection error - retrying in background');
      }
    };

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up SSE connection - useEffect cleanup triggered');
      console.log('🧹 EventSource readyState before close:', eventSource.readyState);
      console.log('🧹 EventSource URL before close:', eventSource.url);
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [tokenPair?.accessToken?.token, uploadProgressSessionCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 useUploadProgress hook unmounting - closing EventSource');
      
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
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
      // Reset reconnect attempts for manual reconnection
      reconnectAttemptsRef.current = 0;
      setError(null);
      // Don't call setUploadProgress(null) here as it causes unnecessary rerenders
      // The useEffect will automatically re-run when the token changes or component remounts
    }
  };
};
