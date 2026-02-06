import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useLocation } from 'react-router-dom';

import { useOpenArxenaSiteWithToken } from '@/auth/hooks/useOpenArxenaSiteWithToken';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { getArxenaSiteUrlWithToken } from '@/auth/utils/arxenaSiteUrl';
import { AppPath } from '@/types/AppPath';

/**
 * Org Charts page: loads arxena-site (arxena.com) in an iframe with the current
 * user's Twenty access token in the URL hash. Arxena-site reads the token, sets
 * the auth_token cookie, and authenticates the user. URL is built client-side.
 * Requires arxena-site to allow framing (CSP frame-ancestors) from app origin.
 */
function OrgChart() {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? null;
  const location = useLocation();
  const { openArxenaSiteWithToken } = useOpenArxenaSiteWithToken();
  const [iframeFailed, setIframeFailed] = useState(false);

  // Subpath on arxena-site: /OrgChart -> '/', /OrgChart/jobs/123 -> '/jobs/123'
  const basePath = `/${AppPath.OrgChart}`;
  const pathname = location.pathname || '';
  const subPath = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : '/';
  const arxenaPath = subPath.startsWith('/') ? subPath : `/${subPath}`;

  const handleIframeError = useCallback(() => {
    setIframeFailed(true);
  }, []);

  if (!accessToken) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        Please sign in to view org charts.
      </div>
    );
  }

  const iframeSrc = getArxenaSiteUrlWithToken(accessToken, arxenaPath);

  const openInNewTab = useCallback(() => {
    openArxenaSiteWithToken({ path: arxenaPath, newTab: true });
  }, [openArxenaSiteWithToken, arxenaPath]);

  return (
    <>
      {iframeFailed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            padding: 16,
            background: '#fff3cd',
            borderBottom: '1px solid #ffc107',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <span>
            Org charts couldn&apos;t load in the app. Make sure arxena-site is
            running (e.g. localhost:5050 in dev) and allows embedding.
          </span>
          <button
            type="button"
            onClick={openInNewTab}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Open in new tab
          </button>
        </div>
      )}
      <iframe
        title="Arxena Org Charts"
        src={iframeSrc}
        style={{
          position: 'fixed',
          top: iframeFailed ? 56 : 0,
          left: 0,
          width: '100%',
          height: iframeFailed ? 'calc(100% - 56px)' : '100%',
          border: 'none',
        }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        onError={handleIframeError}
      />
      <button
        type="button"
        onClick={openInNewTab}
        style={{
          position: 'fixed',
          top: 8,
          right: 8,
          zIndex: 9,
          padding: '6px 12px',
          fontSize: 12,
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
      >
        Open in new tab
      </button>
    </>
  );
}

export default OrgChart;
