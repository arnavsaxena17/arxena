import {
  ARX_CONTENT_SCRIPT_READY,
  pingArxChromeExtension,
} from '@/unipile/utils/linkedinUnipileExtensionBridge';
import { useCallback, useEffect, useState } from 'react';

const PING_INTERVAL_MS = 1500;
const PING_TIMEOUT_MS = 1200;

export const useWaitForChromeExtensionInstalled = () => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkExtensionInstalled = useCallback(async () => {
    setIsChecking(true);
    const extensionId = await pingArxChromeExtension(PING_TIMEOUT_MS);
    const isInstalled = extensionId !== null;
    setIsExtensionInstalled(isInstalled);
    setIsChecking(false);
    return isInstalled;
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const runCheck = async () => {
      if (isCancelled) {
        return;
      }
      await checkExtensionInstalled();
    };

    void runCheck();

    const intervalId = window.setInterval(() => {
      void runCheck();
    }, PING_INTERVAL_MS);

    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (
        event.data?.type === ARX_CONTENT_SCRIPT_READY ||
        event.data?.type === 'EXTENSION_PONG'
      ) {
        setIsExtensionInstalled(true);
        setIsChecking(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };

    window.addEventListener('message', onWindowMessage);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('message', onWindowMessage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checkExtensionInstalled]);

  return {
    isExtensionInstalled,
    isChecking,
    checkExtensionInstalled,
  };
};
