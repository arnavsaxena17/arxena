import { useAuth } from '@/auth/hooks/useAuth';
import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { Trans } from '@lingui/react/macro';
import { ClickToActionLink } from 'twenty-ui/navigation';

export const SignInToAnotherWorkspaceLink = () => {
  const isMultiWorkspaceEnabled = useAtomStateValue(
    isMultiWorkspaceEnabledState,
  );
  const { signOut } = useAuth();

  if (!isMultiWorkspaceEnabled) {
    return null;
  }

  return (
    <ClickToActionLink onClick={signOut}>
      <Trans>Sign in to another workspace</Trans>
    </ClickToActionLink>
  );
};
