// src/components/FacebookSDK.tsx
import { useEffect } from 'react';
// src/types/facebook.ts
export interface FacebookAuthResponse {
    accessToken: string;
    data_access_expiration_time: number;
    expiresIn: number;
    graphDomain: string;
    signedRequest: string;
    userID: string;
  }
  
  export interface FacebookLoginResponse {
    authResponse: FacebookAuthResponse | null;
    status: 'connected' | 'not_authorized' | 'unknown';
  }
  
  export interface FacebookUserData {
    id: string;
    name: string;
    email: string;
  }
  declare global {
    interface Window {
            fbAsyncInit: () => void;
        }
  }
  
    interface FacebookSDK {
      init: (options: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options?: { scope: string }
      ) => void;
      api: (
        path: string,
        params: { fields: string },
        callback: (response: FacebookUserData) => void
      ) => void;
    }
  
  const FACEBOOK_APP_ID =  '702966768619548';
  const FACEBOOK_API_VERSION = 'v18.0';
  
  export const FacebookSDK: React.FC = () => {
    useEffect(() => {
      // Load Facebook SDK
      (function loadFacebookSDK() {
        const id = 'facebook-jssdk';
        if (document.getElementById(id)) return;
        
        const js = document.createElement('script');
        js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        
        const fjs = document.getElementsByTagName('script')[0];
        fjs.parentNode?.insertBefore(js, fjs);
      })();
  
      // Initialize Facebook SDK
      window.fbAsyncInit = function() {
        if (window.FB) {
          window.FB.init({
            appId: FACEBOOK_APP_ID,
            autoLogAppEvents: true,
            xfbml: true,
            version: FACEBOOK_API_VERSION
          });
        }
      };
    }, []);
  
    return null;
  };
  
  