import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/hooks/useAuth';
import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { AppPath } from '@/types/AppPath';

export const VerifyEffect = () => {
  const [searchParams] = useSearchParams();
  const loginToken = searchParams.get('loginToken');

  const isLogged = useIsLogged();
  const navigate = useNavigate();

  const { verify } = useAuth();

  useEffect(() => {
    const getTokens = async () => {
      // Bypass verification for the video-interview route
      console.log("Location. paghment, ", location.pathname)
      if (location.pathname.startsWith('/video-interview') && !location.pathname.includes('video-interview-review')) {
        navigate(location.pathname);
        return;
      }

      if (!loginToken) {
        console.log("No login token so going to signin up")
        navigate(AppPath.SignInUp);
      } else {
        await verify(loginToken);
      }
    };

    if (!isLogged) {
      getTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged, loginToken, location.pathname]);



  return <></>;
};
