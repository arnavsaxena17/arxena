// mixpanelConfig.ts
import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN =
  process.env.REACT_APP_MIXPANEL_TOKEN || '68bdb1eed9eee266fc652c9d5ecef47e';

const DEBUG_MODE = process.env.NODE_ENV !== 'production';
const isDev = process.env.NODE_ENV === 'development';

mixpanel.init(MIXPANEL_TOKEN, {
  debug: DEBUG_MODE,
  track_pageview: true,
  ignore_dnt: true,
  persistence: 'localStorage',
});

const isTrackingEnabled = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'development';

const devLog = (msg: string, ...args: unknown[]) => {
  if (isDev) {
    console.log(msg, ...args);
  }
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