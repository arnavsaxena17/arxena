import { useAuth } from '@/auth/hooks/useAuth';
import { useHasAccessTokenPair } from '@/auth/hooks/useHasAccessTokenPair';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  SIGNED_OUT_QUERY_PARAM,
  clearTokenPairIfSignedOut,
  hasSignedOutMarker,
} from '@/auth/utils/signedOutSession';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useStore } from 'jotai';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';

export const SignInUpGlobalScopeFormEffect = () => {
  const signInUpStep = useAtomStateValue(signInUpStepState);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAuthTokens, navigateAfterMultiWorkspaceSignInUp } = useAuth();
  const { loadCurrentUser } = useLoadCurrentUser();
  const hasAccessTokenPair = useHasAccessTokenPair();
  const store = useStore();

  useEffect(() => {
    const resumeOnCentralDomain = async () => {
      const { user } = await loadCurrentUser();
      await navigateAfterMultiWorkspaceSignInUp(
        user.availableWorkspaces,
        user.email,
      );
    };

    if (
      searchParams.get(SIGNED_OUT_QUERY_PARAM) === '1' ||
      hasSignedOutMarker()
    ) {
      clearTokenPairIfSignedOut();
      store.set(tokenPairState.atom, null);

      if (searchParams.get(SIGNED_OUT_QUERY_PARAM) === '1') {
        searchParams.delete(SIGNED_OUT_QUERY_PARAM);
        setSearchParams(searchParams, { replace: true });
      }

      return;
    }

    const tokenPairFromUrl = searchParams.get('tokenPair');
    if (isDefined(tokenPairFromUrl)) {
      setAuthTokens(JSON.parse(tokenPairFromUrl));
      searchParams.delete('tokenPair');
      setSearchParams(searchParams);
      void resumeOnCentralDomain();
      return;
    }

    if (signInUpStep !== SignInUpStep.Init) return;
    if (!hasAccessTokenPair) return;

    void resumeOnCentralDomain();
  }, [
    searchParams,
    setSearchParams,
    loadCurrentUser,
    setAuthTokens,
    signInUpStep,
    hasAccessTokenPair,
    navigateAfterMultiWorkspaceSignInUp,
    store,
  ]);

  return <></>;
};
