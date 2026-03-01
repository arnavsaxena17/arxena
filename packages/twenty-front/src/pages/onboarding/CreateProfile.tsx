import styled from '@emotion/styled';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Key } from 'ts-key-enum';
import { H2Title, MainButton } from 'twenty-ui';
import { z } from 'zod';

import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useAuth } from '@/auth/hooks/useAuth';
import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersStates';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { ProfilePictureUploader } from '@/settings/profile/components/ProfilePictureUploader';
import { PageHotkeyScope } from '@/types/PageHotkeyScope';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInputV2 } from '@/ui/input/components/TextInputV2';
import { useScopedHotkeys } from '@/ui/utilities/hotkey/hooks/useScopedHotkeys';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';
import { Trans, useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared';
import { OnboardingStatus } from '~/generated/graphql';
import { Mixpanel } from '~/mixpanel';
import { useWebSocketEvent } from '../../modules/websocket-context/useWebSocketEvent';
import { useWebSocket } from '../../modules/websocket-context/WebSocketContextProvider';

const StyledContentContainer = styled.div`
  width: 100%;
`;

const StyledSectionContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledButtonContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
  width: 200px;
`;

const StyledComboInputContainer = styled.div`
  display: flex;
  flex-direction: row;
  > * + * {
    margin-left: ${({ theme }) => theme.spacing(4)};
  }
`;

const validationSchema = z
  .object({
    firstName: z.string().min(1, { message: 'First name can not be empty' }),
    lastName: z.string().min(1, { message: 'Last name can not be empty' }),
  })
  .required();
type Form = z.infer<typeof validationSchema>;

export const CreateProfile = () => {
  const { connected, socket } = useWebSocket();
  const [currentWorkspaceMember, setCurrentWorkspaceMember] = useRecoilState(
    currentWorkspaceMemberState,
  );
  
  // Add WebSocket event listener for metadata structure progress
  useWebSocketEvent<{ step: string; message: string }>(
    'metadata-structure-progress',
    (data: { step: string; message: string }) => {
      if (data?.step === 'metadata-structure-complete') {
        // No need to reload here since we're going to navigate away from this page
      }

      if (socket?.connected) {
        const ackData = {
          event: 'metadata-structure-progress',
          timestamp: new Date().toISOString(),
          status: 'received',
          step: data.step,
          message: data.message,
          userId: currentWorkspaceMember?.id
        };
        socket.emit('notification_received', ackData);
      }
    },
    [socket, currentWorkspaceMember?.id]
  );

  const { t } = useLingui();
  const { loadCurrentUser } = useAuth();
  const onboardingStatus = useOnboardingStatus();
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const { enqueueSnackBar } = useSnackBar();

  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const currentWorkspaceMembers = useRecoilValue(currentWorkspaceMembersState);
  const { updateOneRecord } = useUpdateOneRecord<WorkspaceMember>({
    objectNameSingular: CoreObjectNameSingular.WorkspaceMember,
  });

  const signupUserOnArxena = async (userData: any) => {
    try {
      let arxenaSiteBaseUrl = '';
      if (process.env.NODE_ENV === 'development') {
        arxenaSiteBaseUrl =
          process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl =
          process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }
      const requestParams = new URLSearchParams({
        full_name: userData?.fullName,
        email: userData?.email,
        phone: userData?.phone,
        token: userData?.token,
        password: userData?.password,
        origin: userData?.origin || '',
        visitor_fp: userData?.visitorFp || '',
        currentWorkspaceMemberId: userData?.currentWorkspaceMemberId || '',
        twentyId: userData?.twentyId || '',
        currentWorkspaceId: userData?.currentWorkspaceId || '',
      });

      const response = await fetch(arxenaSiteBaseUrl + '/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // 'Authorization': `Bearer ${userData.token}`, // Ensure the token is sent in the headers
        },
        body: requestParams,
      });
      const data = await response.json();
      return data;
    } catch {
      // Signup on Arxena site is best-effort; continue onboarding on failure
    }
  };

  // Form
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    getValues,
  } = useForm<Form>({
    mode: 'onChange',
    defaultValues: {
      firstName: currentWorkspaceMember?.name?.firstName ?? '',
      lastName: currentWorkspaceMember?.name?.lastName ?? '',
    },
    resolver: zodResolver(validationSchema),
  });

  const onSubmit: SubmitHandler<Form> = useCallback(
    async (data) => {
      try {
        let workspaceMemberId = currentWorkspaceMember?.id;

        if (!workspaceMemberId) {
          const { workspaceMember } = await loadCurrentUser();
          workspaceMemberId =
            workspaceMember?.id ?? currentWorkspaceMembers[0]?.id;
        }

        if (!workspaceMemberId) {
          enqueueSnackBar('Unable to load profile. Please refresh and try again.', {
            variant: SnackBarVariant.Error,
          });
          throw new Error('Workspace member not found');
        }

        if (!data.firstName || !data.lastName) {
          throw new Error('First name or last name is missing');
        }

        await updateOneRecord({
          idToUpdate: workspaceMemberId,
          updateOneRecordInput: {
            name: {
              firstName: data.firstName,
              lastName: data.lastName,
            },
            colorScheme: 'System',
          },
        });

        const fallbackMember = currentWorkspaceMembers.find(
          (m) => m.id === workspaceMemberId,
        );
        setCurrentWorkspaceMember((current) => {
          const base = current ?? fallbackMember;
          if (isDefined(base)) {
            return {
              ...base,
              name: {
                firstName: data.firstName,
                lastName: data.lastName,
              },
              colorScheme: 'System',
            };
          }
          return current;
        });

        const userData = {
          fullName:
            data?.firstName !== '' && data?.lastName !== ''
              ? data?.firstName + ' ' + data?.lastName
              : currentUser?.email.toLowerCase().trim(),
          email: currentUser?.email.toLowerCase().trim(), // Note: gmail/hotmail/yahoo emails are rejected by the backend
          phone: '+1234567890',
          password: 'password',
          visitorFp: 'some-fingerprint-value',
          token: 'some',
          currentWorkspaceMemberId: workspaceMemberId,
          currentWorkspaceId: currentWorkspace?.id,
          twentyId: currentUser?.id,
          origin: currentWorkspace?.subdomain || '',
        };

        try {
          await signupUserOnArxena(userData);
        } catch {
          // Continue onboarding on Arxena signup failure
        }

        Mixpanel.track('onboarding_step', { stepName: 'create_profile' });
        setNextOnboardingStatus();
      } catch {
        // Error already surfaced or handled
      }
    },
    [
      currentWorkspaceMember?.id,
      currentWorkspaceMembers,
      enqueueSnackBar,
      loadCurrentUser,
      setCurrentWorkspaceMember,
      setNextOnboardingStatus,
      updateOneRecord,
    ],
  );

  const [isEditingMode, setIsEditingMode] = useState(false);

  useScopedHotkeys(
    Key.Enter,
    () => {
      if (isEditingMode) {
        onSubmit(getValues());
      }
    },
    PageHotkeyScope.CreateProfile,
  );

  if (onboardingStatus !== OnboardingStatus.PROFILE_CREATION) {
    return null;
  }

  return (
    <>
      <Title noMarginTop>
        <Trans>Create profile</Trans>
      </Title>
      <SubTitle>
        <Trans>How you'll be identified on the app.</Trans>
      </SubTitle>
      <StyledContentContainer>
        <StyledSectionContainer>
          <H2Title title="Picture" />
          <ProfilePictureUploader />
        </StyledSectionContainer>
        <StyledSectionContainer>
          <H2Title
            title={t`Name`}
            description={t`Your name as it will be displayed on the app`}
          />
          {/* TODO: When react-web-hook-form is added to edit page we should create a dedicated component with context */}
          <StyledComboInputContainer>
            <Controller
              name="firstName"
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <TextInputV2
                  autoFocus
                  label={t`First Name`}
                  value={value}
                  onFocus={() => setIsEditingMode(true)}
                  onBlur={() => {
                    onBlur();
                    setIsEditingMode(false);
                  }}
                  onChange={onChange}
                  placeholder="Tim"
                  error={error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="lastName"
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <TextInputV2
                  label={t`Last Name`}
                  value={value}
                  onFocus={() => setIsEditingMode(true)}
                  onBlur={() => {
                    onBlur();
                    setIsEditingMode(false);
                  }}
                  onChange={onChange}
                  placeholder="Cook"
                  error={error?.message}
                  fullWidth
                />
              )}
            />
          </StyledComboInputContainer>
        </StyledSectionContainer>
      </StyledContentContainer>
      <StyledButtonContainer>
        <MainButton
          title={t`Continue`}
          onClick={handleSubmit(onSubmit)}
          disabled={!isValid || isSubmitting}
          fullWidth
        />
      </StyledButtonContainer>
    </>
  );
};