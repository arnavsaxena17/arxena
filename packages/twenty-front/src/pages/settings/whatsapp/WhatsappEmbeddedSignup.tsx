import { css } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useEffect, useCallback, useState } from 'react';
import type {
  WhatsAppEmbeddedSignupProps,
  WhatsAppEmbeddedSignupMessage,
  FacebookLoginResponse
} from './types/whatsappEmbeddedSignUpTypes';

const Card = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  margin: 2rem auto;
  padding: 1.5rem;
`;

const CardHeader = styled.div`
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h2`
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
`;

const Alert = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
`;

const AlertDescription = styled.p`
  color: #4a5568;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const Button = styled.button`
  background-color: #1877f2;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1rem;
  width: 100%;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #166fe5;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(24, 119, 242, 0.4);
  }

  &:disabled {
    background-color: #e4e6eb;
    cursor: not-allowed;
  }
`;

export const WhatsAppEmbeddedSignup: React.FC<WhatsAppEmbeddedSignupProps> = ({
  appId,
  configId,
  graphApiVersion = 'v21.0',
  onSignupComplete,
  onSignupError,
  onSignupCancel
}) => {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
    
    try {
      const data = JSON.parse(event.data) as WhatsAppEmbeddedSignupMessage;
      
      if (data.type === 'WA_EMBEDDED_SIGNUP') {
        if (data.event === 'FINISH') {
          onSignupComplete?.({
            phoneNumberId: data.data.phone_number_id,
            wabaId: data.data.waba_id
          });
        } else if (data.event === 'CANCEL') {
          onSignupCancel?.(data.data.current_step ?? 'unknown');
        }
      }
    } catch (error) {
      onSignupError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [onSignupComplete, onSignupCancel, onSignupError]);

  // Load the Facebook SDK
  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      setSdkLoaded(true);
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup if component unmounts during loading
      const existingScript = document.getElementById('facebook-jssdk');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Initialize the SDK once it's loaded
  useEffect(() => {
    if (!sdkLoaded || !window.FB || sdkInitialized) return;

    try {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: graphApiVersion
      });
      setSdkInitialized(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize Facebook SDK:', error);
      onSignupError?.(error instanceof Error ? error : new Error('Failed to initialize Facebook SDK'));
    }
  }, [sdkLoaded, appId, graphApiVersion, sdkInitialized, onSignupError]);

  // Add message event listener
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleLogin = useCallback(() => {
    if (!sdkInitialized || !window.FB) {
      onSignupError?.(new Error('Facebook SDK not ready'));
      return;
    }

    window.FB.login(
      (response: FacebookLoginResponse) => {
        if (response.authResponse?.code) {
          onSignupComplete?.({ code: response.authResponse.code });
        } else {
          onSignupError?.(new Error('Authentication failed'));
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        }
      }
    );
  }, [configId, onSignupComplete, onSignupError, sdkInitialized]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Business Platform Signup</CardTitle>
      </CardHeader>
      <Alert>
        <AlertDescription>
          Connect your business to the WhatsApp Business Platform to start messaging with your customers.
        </AlertDescription>
      </Alert>
      <Button 
        onClick={handleLogin} 
        disabled={!sdkInitialized || isLoading}
      >
        {isLoading ? 'Loading...' : 'Login with Facebook'}
      </Button>
    </Card>
  );
};

export default WhatsAppEmbeddedSignup;