import { domainConfigurationState } from '@/domain-manager/states/domainConfigurationState';
import { lastAuthenticatedWorkspaceDomainState } from '@/domain-manager/states/lastAuthenticatedWorkspaceDomainState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { cookieStorage } from '~/utils/cookie-storage';

const LAST_AUTHENTICATED_WORKSPACE_DOMAIN_COOKIE_KEY =
  'lastAuthenticateWorkspaceDomain';

export const useLastAuthenticatedWorkspaceDomain = () => {
  const domainConfiguration = useAtomStateValue(domainConfigurationState);
  const setLastAuthenticatedWorkspaceDomain = useSetAtomState(
    lastAuthenticatedWorkspaceDomainState,
  );
  const setLastAuthenticateWorkspaceDomainWithCookieAttributes = (
    params: { workspaceId: string; workspaceUrl: string } | null,
  ) => {
    setLastAuthenticatedWorkspaceDomain({
      ...(params ? params : {}),
      cookieAttributes: {
        domain: `.${domainConfiguration.frontDomain}`,
      },
    });

    if (!params) {
      cookieStorage.removeItem(LAST_AUTHENTICATED_WORKSPACE_DOMAIN_COOKIE_KEY, {
        path: '/',
        domain: `.${domainConfiguration.frontDomain}`,
      });
      cookieStorage.removeItem(LAST_AUTHENTICATED_WORKSPACE_DOMAIN_COOKIE_KEY, {
        path: '/',
      });
    }
  };

  return {
    setLastAuthenticateWorkspaceDomain:
      setLastAuthenticateWorkspaceDomainWithCookieAttributes,
  };
};
