import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { isLoadingTokensFromExtensionState } from '@/chrome-extension-sidecar/states/isLoadingTokensFromExtensionState';
import { isInFrame } from '@/chrome-extension-sidecar/utils/is-in-frame';
import { chromeExtensionIdState } from '@/client-config/states/chromeExtensionIdState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

export const ChromeExtensionSidecarEffect = () => {
  const navigate = useNavigate();
  const setTokenPair = useSetAtomState(tokenPairState);
  const chromeExtensionId = useAtomStateValue(chromeExtensionIdState);
  const setIsLoadingTokensFromExtension = useSetAtomState(
    isLoadingTokensFromExtensionState,
  );

  useEffect(() => {
    if (isInFrame() && isDefined(chromeExtensionId)) {
      window.parent.postMessage(
        'loaded',
        `chrome-extension://${chromeExtensionId}`,
      );

      const handleWindowEvents = (event: MessageEvent) => {
        if (event.origin === `chrome-extension://${chromeExtensionId}`) {
          switch (event.data.type) {
            case 'tokens': {
              setTokenPair(event.data.value);
              setIsLoadingTokensFromExtension(true);
              break;
            }
            case 'navigate':
              navigate(event.data.value);
              break;
            default:
              break;
          }
        } else {
          setIsLoadingTokensFromExtension(false);
          return;
        }
      };
      window.addEventListener('message', handleWindowEvents);
      return () => {
        window.removeEventListener('message', handleWindowEvents);
      };
    }
  }, [
    chromeExtensionId,
    setIsLoadingTokensFromExtension,
    setTokenPair,
    navigate,
  ]);

  return <></>;
};
