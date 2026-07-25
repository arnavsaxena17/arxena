import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { hasMatchingConnectedLinkedinAccount } from 'twenty-shared/utils';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { currentWorkspaceMemberState } from '~/modules/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '~/modules/auth/states/tokenPairState';
import { linkedinUnipileAccountsState } from '~/modules/linkedin-unipile/states/linkedinUnipileAccountsState';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

import { workspaceMemberProfileUnipileFieldsState } from '../states/workspaceMemberProfileUnipileFieldsState';
import { FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE } from './WorkspaceMemberProfileUnipileSyncEffect';

const StyledWrap = styled.div<{ isCompact: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${({ isCompact }) =>
    isCompact ? themeCssVariables.spacing[2] : themeCssVariables.spacing[3]};
`;

const StyledHint = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  line-height: 1.5;
`;

const StyledButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledButton = styled.button<{ variant: 'primary' | 'danger' }>`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 500;
  border: none;
  cursor: pointer;
  background-color: ${({ variant }) =>
    variant === 'danger' ? themeCssVariables.color.red : themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    filter: brightness(0.92);
  }
`;

export type LinkedinStoredProfileUnipileActionsProps = {
  onAfterChange?: () => void;
  isCompact?: boolean;
};

export const LinkedinStoredProfileUnipileActions = ({
  onAfterChange,
  isCompact = false,
}: LinkedinStoredProfileUnipileActionsProps) => {
  const { t } = useLingui();
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();
  const client = useApolloCoreClient();
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const workspaceMemberId = currentWorkspaceMember?.id;
  const workspaceMemberProfileUnipileFields = useAtomStateValue(
    workspaceMemberProfileUnipileFieldsState,
  );
  const linkedinUnipileAccounts = useAtomStateValue(linkedinUnipileAccountsState);

  const [busyConnect, setBusyConnect] = useState(false);
  const [busyDisconnect, setBusyDisconnect] = useState(false);

  const hasConnectedMatch = hasMatchingConnectedLinkedinAccount(
    linkedinUnipileAccounts,
    workspaceMemberProfileUnipileFields,
  );

  const profileLinkedinUnipileId =
    workspaceMemberProfileUnipileFields?.linkedinUnipileAccountId?.trim() ?? '';

  const refetchWorkspaceMemberProfile = useCallback(async () => {
    if (!workspaceMemberId) {
      return;
    }
    await client.query({
      query: FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE,
      variables: {
        filter: { workspaceMemberId: { eq: workspaceMemberId } },
        limit: 1,
      },
      fetchPolicy: 'network-only',
    });
  }, [client, workspaceMemberId]);

  const onConnectFromStoredProfile = useCallback(async () => {
    if (!accessToken) {
      enqueueErrorSnackBar({ message: t`Sign in again to connect LinkedIn.` });
      return;
    }
    setBusyConnect(true);
    try {
      const service = getLinkedinService();
      const result = await service.reconnectFromStoredProfile(accessToken);

      const li = result.linkedin;
      const connected =
        Boolean(li?.connected) ||
        li?.status === 'connected' ||
        li?.status === 'pending';

      if (connected === true) {
        enqueueSuccessSnackBar({ message: t`LinkedIn connected using saved session.` });
        await refetchWorkspaceMemberProfile();
        onAfterChange?.();
        return;
      }

      const reconnectMsg = result.reconnect?.message;
      if (
        reconnectMsg != null &&
        typeof reconnectMsg === 'string' &&
        reconnectMsg.trim() !== ''
      ) {
        enqueueWarningSnackBar({ message: reconnectMsg, options: { duration: 8000, } });
      } else {
        enqueueWarningSnackBar({
          message: t`Could not connect. Save LinkedIn cookies on your profile first (e.g. extension sync), then try again.`,
          options: { duration: 8000 },
        });
      }
      await refetchWorkspaceMemberProfile();
      onAfterChange?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t`Connect from saved profile failed.`;
      enqueueErrorSnackBar({ message: message });
    } finally {
      setBusyConnect(false);
    }
  }, [
    accessToken,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
    onAfterChange,
    refetchWorkspaceMemberProfile,
    t,
  ]);

  const onDisconnectProfileLinked = useCallback(async () => {
    if (!accessToken) {
      enqueueErrorSnackBar({ message: t`Sign in again to disconnect LinkedIn.` });
      return;
    }
    if (!profileLinkedinUnipileId) {
      enqueueWarningSnackBar({
        message: t`No LinkedIn Unipile account ID is stored on your workspace profile.`,
      });
      return;
    }
    if (
      !window.confirm(
        t`Disconnect the LinkedIn Unipile account stored on your workspace profile?`,
      )
    ) {
      return;
    }
    setBusyDisconnect(true);
    try {
      const service = getLinkedinService();
      const result = await service.disconnectAccount(
        profileLinkedinUnipileId,
        accessToken,
      );
      if (result.success) {
        enqueueSuccessSnackBar({ message: t`LinkedIn disconnected.` });
        await refetchWorkspaceMemberProfile();
        onAfterChange?.();
      } else {
        enqueueErrorSnackBar({ message: t`Failed to disconnect.` });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t`Disconnect failed.`;
      enqueueErrorSnackBar({ message: message });
    } finally {
      setBusyDisconnect(false);
    }
  }, [
    accessToken,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
    onAfterChange,
    profileLinkedinUnipileId,
    refetchWorkspaceMemberProfile,
    t,
  ]);

  return (
    <StyledWrap
      isCompact={isCompact}
      data-testid="linkedin-stored-profile-unipile-actions"
    >
      <StyledHint>
        {isCompact ? (
          <Trans>
            Connect or disconnect Unipile from cookies and Unipile account ID
            saved on your recruiter profile (server-side).
          </Trans>
        ) : (
          <Trans>
            Connect or disconnect Unipile using your workspace member profile:
            saved LinkedIn session cookies and the LinkedIn Unipile account ID
            on your recruiter profile (no extension cookie payload required).
          </Trans>
        )}
      </StyledHint>
      <StyledButtonRow>
        <StyledButton
          type="button"
          variant="primary"
          disabled={
            !accessToken || busyConnect || busyDisconnect || hasConnectedMatch
          }
          data-testid="linkedin-connect-from-stored-profile"
          onClick={() => {
            void onConnectFromStoredProfile();
          }}
        >
          <Trans>Connect with saved session</Trans>
        </StyledButton>
        <StyledButton
          type="button"
          variant="danger"
          disabled={
            !accessToken ||
            busyConnect ||
            busyDisconnect ||
            !profileLinkedinUnipileId
          }
          data-testid="linkedin-disconnect-profile-stored-unipile"
          onClick={() => {
            void onDisconnectProfileLinked();
          }}
        >
          <Trans>Disconnect profile-linked account</Trans>
        </StyledButton>
      </StyledButtonRow>
    </StyledWrap>
  );
};
