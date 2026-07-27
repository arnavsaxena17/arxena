import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { getWorkspaceSchemaName } from '@/settings/admin-panel/utils/getWorkspaceSchemaName';
import { SettingsCard } from '@/settings/components/SettingsCard';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsTableCard } from '@/settings/components/SettingsTableCard';
import { DeleteAccount } from '@/settings/profile/components/DeleteAccount';
import { EmailField } from '@/settings/profile/components/EmailField';
import { NameFields } from '@/settings/profile/components/NameFields';
import { SetOrChangePassword } from '@/settings/profile/components/SetOrChangePassword';
import { useCanChangePassword } from '@/settings/profile/hooks/useCanChangePassword';
import { useCurrentUserWorkspaceTwoFactorAuthentication } from '@/settings/two-factor-authentication/hooks/useCurrentUserWorkspaceTwoFactorAuthentication';
import { WorkspaceMemberPictureUploader } from '@/settings/workspace-member/components/WorkspaceMemberPictureUploader';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Status } from 'twenty-ui/data-display';
import {
  IconId,
  IconMail,
  IconShield,
  IconUser,
  IconWorld,
} from 'twenty-ui/icon';
import { Section } from 'twenty-ui/layout';
import { UndecoratedLink } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledIdsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledMonoValue = styled.span`
  font-family: ui-monospace, 'SF Mono', Monaco, monospace;
  font-size: ${themeCssVariables.font.size.xs};
  word-break: break-all;
`;

export const SettingsProfile = () => {
  const { t } = useLingui();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const currentUser = useAtomStateValue(currentUserState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);

  const { currentUserWorkspaceTwoFactorAuthenticationMethods } =
    useCurrentUserWorkspaceTwoFactorAuthentication();

  const has2FAMethod =
    currentUserWorkspaceTwoFactorAuthenticationMethods['TOTP']?.status ===
    'VERIFIED';

  const { canChangePassword } = useCanChangePassword();

  if (!currentWorkspaceMember?.id) {
    return null;
  }

  const memberName =
    [currentWorkspaceMember.name?.firstName, currentWorkspaceMember.name?.lastName]
      .filter(Boolean)
      .join(' ') || '—';

  const workspaceSchemaName = isDefined(currentWorkspace?.id)
    ? getWorkspaceSchemaName(currentWorkspace.id)
    : '—';

  const youInfoItems = [
    {
      Icon: IconId,
      label: t`Member ID`,
      value: (
        <StyledMonoValue>
          {currentWorkspaceMember.id}
        </StyledMonoValue>
      ),
    },
    {
      Icon: IconUser,
      label: t`Name`,
      value: memberName,
    },
    {
      Icon: IconId,
      label: t`User ID`,
      value: (
        <StyledMonoValue>{currentUser?.id ?? '—'}</StyledMonoValue>
      ),
    },
    {
      Icon: IconMail,
      label: t`Email`,
      value: currentUser?.email ?? '—',
    },
  ];

  const workspaceInfoItems = [
    {
      Icon: IconId,
      label: t`Workspace ID`,
      value: (
        <StyledMonoValue>{currentWorkspace?.id ?? '—'}</StyledMonoValue>
      ),
    },
    {
      Icon: IconId,
      label: t`Workspace Schema`,
      value: <StyledMonoValue>{workspaceSchemaName}</StyledMonoValue>,
    },
    {
      Icon: IconWorld,
      label: t`Workspace Name`,
      value: currentWorkspace?.displayName ?? '—',
    },
  ];

  return (
    <SettingsPageLayout
      title={t`Profile`}
      links={[
        {
          children: <Trans>User</Trans>,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        { children: <Trans>Profile</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title title={t`Picture`} />
          <WorkspaceMemberPictureUploader
            workspaceMemberId={currentWorkspaceMember.id}
          />
        </Section>
        <Section>
          <H2Title
            title={t`Name`}
            description={t`Your name as it will be displayed`}
          />
          <NameFields key={currentWorkspaceMember.id} />
        </Section>
        <Section>
          <H2Title
            title={t`IDs`}
            description={t`Your current workspace, user and member IDs`}
          />
          <StyledIdsContainer>
            <SettingsTableCard
              rounded
              items={youInfoItems}
              gridAutoColumns="2fr 5fr"
            />
            <SettingsTableCard
              rounded
              items={workspaceInfoItems}
              gridAutoColumns="2fr 5fr"
            />
          </StyledIdsContainer>
        </Section>
        <Section>
          <H2Title
            title={t`Email`}
            description={t`The email associated to your account`}
          />
          <EmailField />
        </Section>
        <Section>
          <H2Title
            title={t`Two Factor Authentication`}
            description={t`Enhances security by requiring a code along with your password`}
          />
          <UndecoratedLink
            to={getSettingsPath(
              SettingsPath.TwoFactorAuthenticationStrategyConfig,
              { twoFactorAuthenticationStrategy: 'TOTP' },
            )}
          >
            <SettingsCard
              title={t`Authenticator App`}
              Icon={<IconShield />}
              Status={
                has2FAMethod ? (
                  <Status text={t`Active`} color="turquoise" />
                ) : (
                  <Status text={t`Deactivated`} color="gray" />
                )
              }
            />
          </UndecoratedLink>
        </Section>
        {canChangePassword && (
          <Section>
            <SetOrChangePassword />
          </Section>
        )}
        <Section>
          <DeleteAccount />
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
