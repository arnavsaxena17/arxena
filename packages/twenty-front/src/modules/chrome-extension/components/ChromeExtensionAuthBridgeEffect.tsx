import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useEffect } from 'react';

import {
    ARX_CONTENT_SCRIPT_READY,
    ARX_EXTENSION_AUTH_BRIDGE_ACK,
    ARX_EXTENSION_REQUEST_AUTH,
    pushChromeExtensionAuthToContentScript,
} from '@/unipile/utils/linkedinUnipileExtensionBridge';

/**
 * Keeps the Chrome extension's storage in sync with the app JWT and origin whenever
 * the access token or window origin changes (login, refresh, workspace switch).
 */
export const ChromeExtensionAuthBridgeEffect = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessOrWorkspaceAgnosticToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (accessOrWorkspaceAgnosticToken) {
      pushChromeExtensionAuthToContentScript(accessOrWorkspaceAgnosticToken, origin);
    } else if (typeof window !== 'undefined') {
      window.postMessage({ type: 'logout' }, window.location.origin);
    }

    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type === ARX_CONTENT_SCRIPT_READY) {
        pushChromeExtensionAuthToContentScript(accessOrWorkspaceAgnosticToken, origin);
        return;
      }
      if (event.data?.type !== ARX_EXTENSION_REQUEST_AUTH) {
        return;
      }
      pushChromeExtensionAuthToContentScript(accessOrWorkspaceAgnosticToken, origin);
      const requestId = event.data?.requestId;
      window.postMessage(
        {
          type: ARX_EXTENSION_AUTH_BRIDGE_ACK,
          requestId: typeof requestId === 'string' ? requestId : undefined,
        },
        window.location.origin,
      );
    };

    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [accessOrWorkspaceAgnosticToken]);

  return null;
};
