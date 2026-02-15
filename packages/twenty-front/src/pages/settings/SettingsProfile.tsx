import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { H2Title, Section } from 'twenty-ui';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { ChangePassword } from '@/settings/profile/components/ChangePassword';
import { DeleteAccount } from '@/settings/profile/components/DeleteAccount';
import { DownloadApp } from '@/settings/profile/components/DownloadApp';
import { EmailField } from '@/settings/profile/components/EmailField';
import { NameFields } from '@/settings/profile/components/NameFields';
import { ProfilePictureUploader } from '@/settings/profile/components/ProfilePictureUploader';
import { SettingsPath } from '@/types/SettingsPath';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useRecoilValue } from 'recoil';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

const StyledIdsCard = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin-top: ${({ theme }) => theme.spacing(2)};
  overflow: hidden;
  margin-bottom: ${({ theme }) => theme.spacing(6)};
`;

const StyledIdsRow = styled.div`
  align-items: baseline;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};

  &:last-of-type {
    border-bottom: none;
  }
`;

const StyledIdsLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 140px;
`;

const StyledIdsValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ui-monospace, 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SettingsProfile = () => {
  const { t } = useLingui();
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentUser = useRecoilValue(currentUserState);
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
            title={t`IDs`}
            description={t`Your current workspace, user and member IDs`}
          />
          <StyledIdsCard key={currentWorkspaceMember?.id}>
            <StyledIdsRow>
              <StyledIdsLabel>Member ID</StyledIdsLabel>
              <StyledIdsValue title={currentWorkspaceMember?.id}>
                {currentWorkspaceMember?.id}
              </StyledIdsValue>
            </StyledIdsRow>
            <StyledIdsRow>
              <StyledIdsLabel>Member Name</StyledIdsLabel>
              <StyledIdsValue>
                {[currentWorkspaceMember?.name?.firstName, currentWorkspaceMember?.name?.lastName]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </StyledIdsValue>
            </StyledIdsRow>
            <StyledIdsRow>
              <StyledIdsLabel>User ID</StyledIdsLabel>
              <StyledIdsValue title={currentUser?.id}>{currentUser?.id}</StyledIdsValue>
            </StyledIdsRow>
            <StyledIdsRow>
              <StyledIdsLabel>User Email</StyledIdsLabel>
              <StyledIdsValue>{currentUser?.email ?? '—'}</StyledIdsValue>
            </StyledIdsRow>
            <StyledIdsRow>
              <StyledIdsLabel>Workspace ID</StyledIdsLabel>
              <StyledIdsValue title={currentWorkspace?.id}>
                {currentWorkspace?.id}
              </StyledIdsValue>
            </StyledIdsRow>
            <StyledIdsRow>
              <StyledIdsLabel>Workspace Name</StyledIdsLabel>
              <StyledIdsValue>{currentWorkspace?.displayName ?? '—'}</StyledIdsValue>
            </StyledIdsRow>
          </StyledIdsCard>
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
          <DownloadApp />
        </Section>
        <Section>
          <DeleteAccount />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
