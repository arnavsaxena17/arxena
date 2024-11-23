// types.ts

declare global {
    interface Window {
      FB: {
        init: (config: {
          appId: string;
          autoLogAppEvents: boolean;
          xfbml: boolean;
          version: string;
        }) => void;
        login: (
          callback: (response: FacebookLoginResponse) => void,
          options: FacebookLoginOptions
        ) => void;
      };
      fbAsyncInit: () => void;
    }
  }
  
  export interface WhatsAppEmbeddedSignupProps {
    /** Your Facebook App ID */
    appId: string;
    /** Your Facebook Login for Business configuration ID */
    configId: string;
    /** Graph API version (default: 'v21.0') */
    graphApiVersion?: string;
    /** Callback when signup is completed successfully */
    onSignupComplete?: (data: SignupCompleteData) => void;
    /** Callback when signup is cancelled */
    onSignupCancel?: (currentStep: string) => void;
    /** Callback when an error occurs during signup */
    onSignupError?: (error: Error) => void;
  }
  
  export interface SignupCompleteData {
    phoneNumberId?: string;
    wabaId?: string;
    code?: string;
  }
  
  export interface FacebookLoginResponse {
    authResponse?: {
      code: string;
    };
    status?: string;
  }
  
  export interface FacebookLoginOptions {
    config_id: string;
    response_type: string;
    override_default_response_type: boolean;
    extras: {
      setup: Record<string, unknown>;
      featureType: string;
      sessionInfoVersion: string;
    };
  }
  
  export interface WhatsAppEmbeddedSignupMessage {
    type: string;
    event: 'FINISH' | 'CANCEL';
    version: number;
    data: {
      phone_number_id?: string;
      waba_id?: string;
      current_step?: string;
    };
  }