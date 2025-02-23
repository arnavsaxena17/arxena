// mixpanelConfig.ts
import mixpanel from 'mixpanel-browser';

// Initialize with your project token
console.log("process.env.REACT_APP_MIXPANEL_TOKEN:", process.env.REACT_APP_MIXPANEL_TOKEN)
const MIXPANEL_TOKEN = process.env.REACT_APP_MIXPANEL_TOKEN || '68bdb1eed9eee266fc652c9d5ecef47e';

// Enable debug logging in development
const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Initialize Mixpanel with configuration
mixpanel.init(MIXPANEL_TOKEN, {
  debug: DEBUG_MODE,
  track_pageview: true,
  ignore_dnt: true, // This will ignore the "Do Not Track" browser setting
  persistence: 'localStorage',
  // api_host: "https://api-eu.mixpanel.com",  // Use if you need EU data residency
  // opt_out_tracking_by_default: false
});

// Check if tracking should be enabled
const isTrackingEnabled = () => {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development';
};

// Wrapper for Mixpanel actions
export const Mixpanel = {
  identify: (id: string) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.identify(id);
        console.log('Mixpanel identify:', id);
      } catch (error) {
        console.error('Mixpanel identify error:', error);
      }
    }
  },

  alias: (id: string) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.alias(id);
        console.log('Mixpanel alias:', id);
      } catch (error) {
        console.error('Mixpanel alias error:', error);
      }
    }
  },

  track: (name: string, props?: Record<string, any>) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.track(name, {
          ...props,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV
        });
        console.log('Mixpanel track:', name, props);
      } catch (error) {
        console.error('Mixpanel track error:', error);
      }
    }
  },

  people: {
    set: (props: Record<string, any>) => {
      if (isTrackingEnabled()) {
        try {
          mixpanel.people.set(props);
          console.log('Mixpanel people.set:', props);
        } catch (error) {
          console.error('Mixpanel people.set error:', error);
        }
      }
    }
  },
  
  // Helper to track page views
  trackPageView: (pageName: string) => {
    if (isTrackingEnabled()) {
      try {
        mixpanel.track('Page View', {
          page: pageName,
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
        console.log('Mixpanel page view:', pageName);
      } catch (error) {
        console.error('Mixpanel page view error:', error);
      }
    }
  }
};