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
import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
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
  
  // Add WebSocket event listener for metadata structure progress
  useWebSocketEvent<{ step: string; message: string }>(
    'metadata-structure-progress',
    (data: { step: string; message: string }) => {
      console.log('CreateProfile component received WebSocket event:', data);
      
      if (data?.step === 'metadata-structure-complete') {
        console.log('CreateProfile: Metadata structure creation completed');
        // No need to reload here since we're going to navigate away from this page
      }
    },
    []
  );

  const { t } = useLingui();
  const onboardingStatus = useOnboardingStatus();
  const [tokenPair] = useRecoilState(tokenPairState)
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const { enqueueSnackBar } = useSnackBar();
  const [currentWorkspaceMember, setCurrentWorkspaceMember] = useRecoilState(
    currentWorkspaceMemberState,
  );
  console.log('currentWorkspaceMember in create profile::', currentWorkspaceMember);
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { updateOneRecord } = useUpdateOneRecord<WorkspaceMember>({
    objectNameSingular: CoreObjectNameSingular.WorkspaceMember,
  });
console.log('currentUser in create profile::', currentUser);

  const createWorkspaceModifications = async () => {
    // Run in background and don't wait for response
    fetch(
      `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/create-metadata-structure`,
      { method: 'POST', headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } },
    ).then(() => {
      console.log('Metadata structure creation completed in background');
    }).catch((error) => {
      console.error('Error creating metadata structure:', error);
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to create metadata structure: ${error.message}`
          : 'Failed to create metadata structure',
        {
          variant: SnackBarVariant.Error,
        },
      );
    });
    // Return immediately to not block execution
    return true;
  };



  const signupUserOnArxena = async (userData: any) => {
    console.log('Going to create user on Arxena using user data:', userData);
    try {
      console.log(
        'process.env.REACT_APP_ARXENA_SITE_BASE_URL:',
        process.env.REACT_APP_ARXENA_SITE_BASE_URL,
      );
      console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
      console.log(
        'process.env.ARXENA_SITE_BASE_URL:',
        process.env.ARXENA_SITE_BASE_URL,
      );
      console.log(
        'process.env.ARXENA_SITE_BASE_URL:',
        process.env.ARXENA_SITE_BASE_URL,
      );
      let arxenaSiteBaseUrl = '';
      if (process.env.NODE_ENV === 'development') {
        arxenaSiteBaseUrl =
          process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl =
          process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }
      console.log('Final Arxena Site Base URL', arxenaSiteBaseUrl);
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
      
      console.log('This is ther requst params:', requestParams);
      const response = await fetch(arxenaSiteBaseUrl + '/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // 'Authorization': `Bearer ${userData.token}`, // Ensure the token is sent in the headers
        },
        body: requestParams,
      });
      console.log('signupUserO nArxena response:', response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.log('Signup error:', error);
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
        console.log('Submit has been clicked so somet stuff');
        if (!currentWorkspaceMember?.id) {
          throw new Error('User is not logged in');
        }
        if (!data.firstName || !data.lastName) {
          throw new Error('First name or last name is missing');
        }
        console.log('Some update records');

        await updateOneRecord({
          idToUpdate: currentWorkspaceMember?.id,
          updateOneRecordInput: {
            name: {
              firstName: data.firstName,
              lastName: data.lastName,
            },
            colorScheme: 'System',
          },
        });

        console.log('Som etting');
        setCurrentWorkspaceMember((current) => {
          if (isDefined(current)) {
            return {
              ...current,
              name: {
                firstName: data.firstName,
                lastName: data.lastName,
              },
              colorScheme: 'System',
            };
          }
          return current;
        });
        
        // Start metadata structure creation in background
        createWorkspaceModifications();
        
        setNextOnboardingStatus();
        console.log('Some email and user data');
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
          currentWorkspaceMemberId: currentWorkspaceMember.id,
          currentWorkspaceId: currentWorkspace?.id,
          twentyId: currentUser?.id,
          origin: currentWorkspace?.subdomain || '',
        };

        try {
          console.log('signup with user on arxena');
          await signupUserOnArxena(userData);
        } catch (err) {
          console.log('Error while signing up on Arxena:', err);
        }
      } catch (error: any) {
        console.log('ERROR', error);
        // enqueueSnackBar(error?.message, {
        //   variant: SnackBarVariant.Error,
        // });
      }
    },
    [
      currentWorkspaceMember?.id,
      setNextOnboardingStatus,
      enqueueSnackBar,
      setCurrentWorkspaceMember,
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