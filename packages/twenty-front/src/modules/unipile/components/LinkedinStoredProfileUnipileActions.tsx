import styled from '@emotion/styled';
import { useApolloClient } from '@apollo/client';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasMatchingConnectedLinkedinAccount } from 'twenty-shared';

import { currentWorkspaceMemberState } from '~/modules/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '~/modules/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';
import { linkedinUnipileAccountsState } from '~/modules/linkedin-unipile/states/linkedinUnipileAccountsState';

import { FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE } from './WorkspaceMemberProfileUnipileSyncEffect';
import { workspaceMemberProfileUnipileFieldsState } from '../states/workspaceMemberProfileUnipileFieldsState';

const StyledWrap = styled.div<{ isCompact: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme, isCompact }) => (isCompact ? theme.spacing(2) : theme.spacing(3))};
`;

const StyledHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: 1.5;
`;

const StyledButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button<{ variant: 'primary' | 'danger' }>`
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  border: none;
  cursor: pointer;
  background-color: ${({ theme, variant }) =>
    variant === 'danger' ? theme.color.red : theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};

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
  const { enqueueSnackBar } = useSnackBar();
  const client = useApolloClient();
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
  const workspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const workspaceMemberId = workspaceMember?.id;
  const profileFields = useRecoilValue(workspaceMemberProfileUnipileFieldsState);
  const linkedinAccounts = useRecoilValue(linkedinUnipileAccountsState);

  const [busyConnect, setBusyConnect] = useState(false);
  const [busyDisconnect, setBusyDisconnect] = useState(false);

  const hasConnectedMatch = hasMatchingConnectedLinkedinAccount(
    linkedinAccounts,
    profileFields,
  );

  const profileLinkedinUnipileId =
    profileFields?.linkedinUnipileAccountId?.trim() ?? '';

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
      enqueueSnackBar(t`Sign in again to connect LinkedIn.`, {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    setBusyConnect(true);
    try {
      const service = getLinkedinService();
      const result = await service.reconnectFromStoredProfile(accessToken, {
        user_agent:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });

      const li = result.linkedin;
      const connected =
        Boolean(li?.connected) ||
        li?.status === 'connected' ||
        li?.status === 'pending';

      if (connected) {
        enqueueSnackBar(t`LinkedIn connected using saved session.`, {
          variant: SnackBarVariant.Success,
        });
        await refetchWorkspaceMemberProfile();
        onAfterChange?.();
        return;
      }

      if (result.reconnect?.message) {
        enqueueSnackBar(String(result.reconnect.message), {
          variant: SnackBarVariant.Warning,
          duration: 8000,
        });
      } else {
        enqueueSnackBar(
          t`Could not connect. Save LinkedIn cookies on your profile first (e.g. extension sync), then try again.`,
          { variant: SnackBarVariant.Warning, duration: 8000 },
        );
      }
      await refetchWorkspaceMemberProfile();
      onAfterChange?.();
    } catch (err) {
      enqueueSnackBar(
        err instanceof Error ? err.message : t`Connect from saved profile failed.`,
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setBusyConnect(false);
    }
  }, [
    accessToken,
    enqueueSnackBar,
    onAfterChange,
    refetchWorkspaceMemberProfile,
    t,
  ]);

  const onDisconnectProfileLinked = useCallback(async () => {
    if (!accessToken) {
      enqueueSnackBar(t`Sign in again to disconnect LinkedIn.`, {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    if (!profileLinkedinUnipileId) {
      enqueueSnackBar(
        t`No LinkedIn Unipile account ID is stored on your workspace profile.`,
        { variant: SnackBarVariant.Warning },
      );
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
        enqueueSnackBar(t`LinkedIn disconnected.`, {
          variant: SnackBarVariant.Success,
        });
        await refetchWorkspaceMemberProfile();
        onAfterChange?.();
      } else {
        enqueueSnackBar(t`Failed to disconnect.`, {
          variant: SnackBarVariant.Error,
        });
      }
    } catch (err) {
      enqueueSnackBar(
        err instanceof Error ? err.message : t`Disconnect failed.`,
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setBusyDisconnect(false);
    }
  }, [
    accessToken,
    enqueueSnackBar,
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
            saved LinkedIn session cookies and the LinkedIn Unipile account ID on
            your recruiter profile (no extension cookie payload required).
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
