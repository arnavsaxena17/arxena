// Don't use this hook directly! Prefer the high level hooks like:
// useRedirectToDefaultDomain and useRedirectToWorkspaceDomain

import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export const useRedirect = () => {
  const redirect = useDebouncedCallback((url: string, target?: string) => {
    window.open(url, target ?? '_self');
  }, 1);

  // Clearing the session unmounts the caller before this 1ms debounce fires,
  // which used to leave the deleted workspace on screen.
  useEffect(() => {
    return () => {
      redirect.flush();
    };
  }, [redirect]);

  return {
    redirect,
  };
};
