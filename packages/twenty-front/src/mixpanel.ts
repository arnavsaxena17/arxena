// mixpanelConfig.ts
import mixpanel from 'mixpanel-browser';

/** Production project default (browser token is public). */
const DEFAULT_MIXPANEL_PRODUCTION_TOKEN =
  '68bdb1eed9eee266fc652c9d5ecef47e';

/** Dev/staging Mixpanel project — used whenever NODE_ENV !== 'production'. */
const DEFAULT_MIXPANEL_DEVELOPMENT_PROJECT_TOKEN =
  '5e39ab7cf4b71a25f7cf7bb16936ec1d';

const DEBUG_MODE = process.env.NODE_ENV !== 'production';
const isDev = process.env.NODE_ENV === 'development';

const isMixpanelSendingEnabled =
  process.env.NODE_ENV === 'production' ||
  process.env.REACT_APP_MIXPANEL_ALLOW_IN_DEVELOPMENT === 'true';

const resolveMixpanelToken = (): string => {
  if (process.env.NODE_ENV === 'production') {
    return (
      process.env.REACT_APP_MIXPANEL_TOKEN ?? DEFAULT_MIXPANEL_PRODUCTION_TOKEN
    );
  }
  return (
    process.env.REACT_APP_MIXPANEL_DEV_TOKEN ??
    DEFAULT_MIXPANEL_DEVELOPMENT_PROJECT_TOKEN
  );
};

const MIXPANEL_TOKEN = resolveMixpanelToken();

const isTrackingEnabled = () => isMixpanelSendingEnabled;

const devLog = (msg: string, ...args: unknown[]) => {
  if (isDev) {
    console.log(msg, ...args);
  }
};

const getDeploymentLabel = (): string =>
  process.env.REACT_APP_ANALYTICS_DEPLOYMENT ??
  process.env.NODE_ENV ??
  'unknown';

const inferWorkspaceSubdomainFromHostname = (hostname: string): string => {
  const bare = hostname.replace(/^www\./iu, '').toLowerCase();
  if (bare === 'localhost' || bare === '127.0.0.1') {
    return '(localhost)';
  }
  const segments = bare.split('.');
  if (segments.length >= 3) {
    return segments[0] ?? '(unknown)';
  }
  return '(apex)';
};

const applyCoreRegisteredSuperProperties = () => {
  if (!isMixpanelSendingEnabled || typeof window === 'undefined') {
    return;
  }
  const deployment = getDeploymentLabel();
  const environment = process.env.NODE_ENV ?? 'unknown';
  const workspace_subdomain = inferWorkspaceSubdomainFromHostname(
    window.location.hostname,
  );
  try {
    mixpanel.register({
      deployment,
      environment,
      workspace_subdomain,
    });
    devLog('Mixpanel register core:', {
      deployment,
      environment,
      workspace_subdomain,
    });
  } catch (error) {
    if (isDev) {
      console.error('Mixpanel register core error:', error);
    }
  }
};

mixpanel.init(MIXPANEL_TOKEN, {
  debug: DEBUG_MODE,
  track_pageview: isMixpanelSendingEnabled,
  ignore_dnt: true,
  persistence: 'localStorage',
});

if (isMixpanelSendingEnabled) {
  applyCoreRegisteredSuperProperties();
}

export type MixpanelWorkspaceContextProps = {
  workspaceSubdomain?: string | null | undefined;
  workspaceId?: string | null | undefined;
};

export const Mixpanel = {
  identify: (id: string) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.identify(id);
        devLog('Mixpanel identify:', id);
      } catch (error) {
        if (isDev) {
          console.error('Mixpanel identify error:', error);
        }
      }
    }
  },

  alias: (id: string) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.alias(id);
        devLog('Mixpanel alias:', id);
      } catch (error) {
        if (isDev) {
          console.error('Mixpanel alias error:', error);
        }
      }
    }
  },

  /** Canonical workspace from API (overrides hostname-only inference). */
  registerWorkspaceContext: (context: MixpanelWorkspaceContextProps) => {
    if (!isTrackingEnabled()) {
      return;
    }
    try {
      const next: Record<string, string> = {};
      if (context.workspaceSubdomain) {
        next.workspace_subdomain = context.workspaceSubdomain;
      }
      if (context.workspaceId) {
        next.workspace_id = context.workspaceId;
      }
      if (Object.keys(next).length === 0) {
        return;
      }
      mixpanel.register(next);
      devLog('Mixpanel register workspace:', next);
    } catch (error) {
      if (isDev) {
        console.error('Mixpanel register workspace error:', error);
      }
    }
  },

  /** Keeps pathname on super properties so Autocapture / automatic page views align with SPA routes. */
  syncRouteContext: (routePathname: string) => {
    if (!isTrackingEnabled()) {
      return;
    }
    try {
      mixpanel.register({ pathname: routePathname });
      devLog('Mixpanel register route pathname:', routePathname);
    } catch (error) {
      if (isDev) {
        console.error('Mixpanel register route error:', error);
      }
    }
  },

  track: (name: string, props?: Record<string, unknown>) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.track(name, {
          ...props,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        });
        devLog('Mixpanel track:', name, props);
      } catch (error) {
        if (isDev) {
          console.error('Mixpanel track error:', error);
        }
      }
    }
  },

  people: {
    set: (props: Record<string, unknown>) => {
      if (isTrackingEnabled()) {
        try {
          mixpanel.people.set(props);
          devLog('Mixpanel people.set:', props);
        } catch (error) {
          if (isDev) {
            console.error('Mixpanel people.set error:', error);
          }
        }
      }
    },
  },

  trackPageView: (pageName: string) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.track('Page View', {
          page: pageName,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        });
        devLog('Mixpanel page view:', pageName);
      } catch (error) {
        if (isDev) {
          console.error('Mixpanel page view error:', error);
        }
      }
    }
  },
};
