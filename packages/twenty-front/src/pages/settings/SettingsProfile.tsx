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
import { getWorkspaceSchemaName } from 'twenty-shared';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

const StyledIdsCard = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin-top: ${({ theme }) => theme.spacing(2)};
  overflow: hidden;
`;

const StyledIdsSection = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  &:not(:last-of-type) {
    border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  }
`;

const StyledIdsSectionTitle = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  letter-spacing: 0.5px;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  text-transform: uppercase;
`;

const StyledIdRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5)} 0;

  &:not(:last-of-type) {
    border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  }
`;

const StyledIdLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 140px;
`;

const StyledIdValue = styled.span<{ $mono?: boolean }>`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  word-break: break-all;
  ${({ $mono, theme }) =>
    $mono &&
    `
    font-family: ui-monospace, 'SF Mono', Monaco, monospace;
    font-size: ${theme.font.size.xs};
  `}
`;

export const SettingsProfile = () => {
  const { t } = useLingui();
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);

  const memberName = [currentWorkspaceMember?.name?.firstName, currentWorkspaceMember?.name?.lastName]
    .filter(Boolean)
    .join(' ') || '—';

  const workspaceSchemaName = currentWorkspace?.id
    ? getWorkspaceSchemaName(currentWorkspace.id)
    : '—';

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
            title={t`Full Name`}
            description={t`Your name as it is`}
          />
          <NameFields />
        </Section>
        <Section>
          <H2Title
            title={t`IDs`}
            description={t`Your current workspace, user and member IDs`}
          />
          <StyledIdsCard>
            <StyledIdsSection>
              <StyledIdsSectionTitle>{t`You`}</StyledIdsSectionTitle>
              <StyledIdRow>
                <StyledIdLabel>{t`Member ID`}</StyledIdLabel>
                <StyledIdValue $mono>{currentWorkspaceMember?.id ?? '—'}</StyledIdValue>
              </StyledIdRow>
              <StyledIdRow>
                <StyledIdLabel>{t`Name`}</StyledIdLabel>
                <StyledIdValue>{memberName}</StyledIdValue>
              </StyledIdRow>
              <StyledIdRow>
                <StyledIdLabel>{t`User ID`}</StyledIdLabel>
                <StyledIdValue $mono>{currentUser?.id ?? '—'}</StyledIdValue>
              </StyledIdRow>
              <StyledIdRow>
                <StyledIdLabel>{t`Email`}</StyledIdLabel>
                <StyledIdValue>{currentUser?.email ?? '—'}</StyledIdValue>
              </StyledIdRow>
            </StyledIdsSection>
            <StyledIdsSection>
              <StyledIdsSectionTitle>{t`Workspace`}</StyledIdsSectionTitle>
              <StyledIdRow>
                <StyledIdLabel>{t`Workspace ID`}</StyledIdLabel>
                <StyledIdValue $mono>{currentWorkspace?.id ?? '—'}</StyledIdValue>
              </StyledIdRow>
              <StyledIdRow>
                <StyledIdLabel>{t`Workspace Schema`}</StyledIdLabel>
                <StyledIdValue $mono>{workspaceSchemaName}</StyledIdValue>
              </StyledIdRow>
              <StyledIdRow>
                <StyledIdLabel>{t`Workspace Name`}</StyledIdLabel>
                <StyledIdValue>{currentWorkspace?.displayName ?? '—'}</StyledIdValue>
              </StyledIdRow>
            </StyledIdsSection>
          </StyledIdsCard>
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
