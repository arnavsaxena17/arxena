import { Trans, useLingui } from '@lingui/react/macro';
import { H2Title, Section } from 'twenty-ui';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import { currentUserWorkspaceState } from '@/auth/states/currentUserWorkspaceState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { ChangePassword } from '@/settings/profile/components/ChangePassword';
import { DeleteAccount } from '@/settings/profile/components/DeleteAccount';
import { EmailField } from '@/settings/profile/components/EmailField';
import { NameFields } from '@/settings/profile/components/NameFields';
import { ProfilePictureUploader } from '@/settings/profile/components/ProfilePictureUploader';
import { SettingsPath } from '@/types/SettingsPath';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useRecoilValue } from 'recoil';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

export const SettingsProfile = () => {
  const { t } = useLingui();
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentUser = useRecoilValue(currentUserState);
  const currentUserWorkspace = useRecoilValue(currentUserWorkspaceState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  return (
    <SubMenuTopBarContainer
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
          <ProfilePictureUploader />
        </Section>
        <Section>
          <H2Title
            title={`Full Name`}
            description={`Your name as it is`}
          />
          <H2Title
            title={`IDs`}
            description={`Your current workspace, user and member IDs`}
          />
          <div key={currentWorkspaceMember?.id}>
            <p>Current Member ID: {currentWorkspaceMember?.id}</p>
            <p>Current Workspace Member Name: {currentWorkspaceMember?.name?.firstName} {currentWorkspaceMember?.name?.lastName}</p>
            <p>Current User ID: {currentUser?.id}</p>
            <p>Current User Name: {currentUser?.email}</p>
            <p>Current Workspace ID: {currentWorkspace?.id}</p>
            <p>Current Workspace Name: {currentWorkspace?.displayName}</p>
          </div>
          <NameFields />
        </Section>
        <Section>
          <H2Title
            title={`Email Address`}
            description={t`The email associated to your account`}
          />
          <EmailField />
        </Section>
        <Section>
          <ChangePassword />
        </Section>
        <Section>
          <DeleteAccount />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
