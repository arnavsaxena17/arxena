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
    const pingMessage = {
      type: 'EXTENSION_PING',
      timestamp: Date.now(),
    };

    const handleMessage = (event: MessageEvent) => {
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

    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      setState(prev => ({
        ...prev,
        isExtensionInstalled: false,
        isChecking: false,
        error: 'Extension not responding',
      }));
    }, 3000);

    window.addEventListener('message', handleMessage);
    window.postMessage(pingMessage, window.location.origin);
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
