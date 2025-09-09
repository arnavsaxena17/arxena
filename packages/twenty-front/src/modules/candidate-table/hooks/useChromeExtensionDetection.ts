import { useCallback, useEffect, useState } from 'react';

type ExtensionDetectionState = {
  isExtensionInstalled: boolean;
  isChecking: boolean;
  error: string | null;
};

export const useChromeExtensionDetection = () => {
  const [state, setState] = useState<ExtensionDetectionState>({
    isExtensionInstalled: false,
    isChecking: false,
    error: null,
  });

  const checkExtensionInstalled = useCallback(() => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    // Send a ping message to check if extension is listening
    const pingMessage = {
      type: 'EXTENSION_PING',
      timestamp: Date.now(),
    };

    // Set up a timeout for the response
    const timeoutId = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isExtensionInstalled: false,
        isChecking: false,
        error: 'Extension not responding',
      }));
    }, 3000); // 3 second timeout

    // Set up message listener for response
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is from our extension
      if (event.data?.type === 'EXTENSION_PONG') {
        clearTimeout(timeoutId);
        setState(prev => ({
          ...prev,
          isExtensionInstalled: true,
          isChecking: false,
          error: null,
        }));
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Send the ping message
    window.postMessage(pingMessage, window.location.origin);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Check extension on mount
  useEffect(() => {
    const cleanup = checkExtensionInstalled();
    return cleanup;
  }, [checkExtensionInstalled]);

  // Periodically check extension status (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isChecking) {
        checkExtensionInstalled();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [checkExtensionInstalled, state.isChecking]);

  return {
    ...state,
    checkExtensionInstalled,
  };
};
