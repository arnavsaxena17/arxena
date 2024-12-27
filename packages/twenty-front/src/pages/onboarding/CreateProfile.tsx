import { useCallback, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import styled from '@emotion/styled';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Key } from 'ts-key-enum';
import { H2Title } from 'twenty-ui';
import { z } from 'zod';

import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useOnboardingStatus } from '@/auth/hooks/useOnboardingStatus';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { OnboardingStatus } from '@/auth/utils/getOnboardingStatus';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ProfilePictureUploader } from '@/settings/profile/components/ProfilePictureUploader';
import { PageHotkeyScope } from '@/types/PageHotkeyScope';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { MainButton } from '@/ui/input/button/components/MainButton';
import { TextInputV2 } from '@/ui/input/components/TextInputV2';
import { useScopedHotkeys } from '@/ui/utilities/hotkey/hooks/useScopedHotkeys';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';
import { currentUserState } from '@/auth/states/currentUserState';

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
  const onboardingStatus = useOnboardingStatus();
  const { enqueueSnackBar } = useSnackBar();
  const [currentWorkspaceMember, setCurrentWorkspaceMember] = useRecoilState(
    currentWorkspaceMemberState,
  );

  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  console.log("currentUser:", currentUser);
  console.log("currentWorkspace:", currentWorkspace);
  console.log("currentWorkspaceState:", currentWorkspaceState);


  const { updateOneRecord } = useUpdateOneRecord<WorkspaceMember>({
    objectNameSingular: CoreObjectNameSingular.WorkspaceMember,
  });


  async function signupUserOnArxena(userData: any) {
    console.log("Going to create user on Arxena using user data:", userData);
    try {
      console.log('process.env.REACT_APP_ARXENA_SITE_BASE_URL:', process.env.REACT_APP_ARXENA_SITE_BASE_URL);
      console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
      console.log('process.env.ARXENA_SITE_BASE_URL:', process.env.ARXENA_SITE_BASE_URL);
      console.log('process.env.ARXENA_SITE_BASE_URL:', process.env.ARXENA_SITE_BASE_URL);
      let arxenaSiteBaseUrl: string = '';
      if (process.env.NODE_ENV === 'development') {
        arxenaSiteBaseUrl = process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl = process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }
      console.log('Final Arxena Site Base URL', arxenaSiteBaseUrl);
      const requestParams = new URLSearchParams({
        full_name: userData?.fullName,
        email: userData?.email,
        phone: userData?.phone,
        token: userData?.token,
        password: userData?.password,
        visitor_fp: userData?.visitorFp || '',
        currentWorkspaceMemberId: userData?.currentWorkspaceMemberId || '',
        twentyId: userData?.twentyId || '',
        currentWorkspaceId: userData?.currentWorkspaceId || '',
      })
      console.log("This is ther requst params:", requestParams);
      const response = await fetch(arxenaSiteBaseUrl + '/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // 'Authorization': `Bearer ${userData.token}`, // Ensure the token is sent in the headers
        },
        body: requestParams,
      });
      console.log('signupUserOnArxena response:', response);

      const data = await response.json();
      return data;
    } catch (error) {
      console.log('Signup error:', error);
    }
  }


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
  console.log("currentWorkspaceMember:", currentWorkspaceMember);
  const onSubmit: SubmitHandler<Form> = useCallback(
    async (data) => {
      try {
        if (!currentWorkspaceMember?.id) {
          throw new Error('User is not logged in');
        }
        if (!data.firstName || !data.lastName) {
          throw new Error('First name or last name is missing');
        }

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

        setCurrentWorkspaceMember(
          (current) =>
            ({
              ...current,
              name: {
                firstName: data.firstName,
                lastName: data.lastName,
              },
              colorScheme: 'System',
            }) as any,
        );
        
        // const currentUser = useRecoilValue(currentUserState);
        // console.log("Creating current user:", currentUser);
        console.log("Creating current workspace member:", currentWorkspaceMember);
        console.log("Creating current workspace member data:", currentWorkspaceMember.name);
        console.log("Creating current workspace member data:", currentWorkspaceMember.id);
        console.log("Creating current user Id:", currentUser?.id);
        // console.log("Creating current workspace member userEmail:", currentWorkspaceMember.userEmail);
        // console.log("Creating WorkspaceMember:", ÷);
        const userData = {
          fullName: (data?.firstName !== '' && data?.lastName !== '') 
            ? data?.firstName + ' ' + data?.lastName 
            : currentUser?.email.toLowerCase().trim(),
            email: currentUser?.email.toLowerCase().trim(), // Note: gmail/hotmail/yahoo emails are rejected by the backend
            phone: '+1234567890',
            password: 'password',
            visitorFp: 'some-fingerprint-value',
            token: 'some' ,
            currentWorkspaceMemberId:currentWorkspaceMember.id,
            currentWorkspaceId: currentWorkspace?.id,
            twentyId:currentUser?.id,
          };
      
          try {
            console.log("signup with user on arxena")
            await signupUserOnArxena(userData);
          } catch (err) {
            console.log('Error while signing up on Arxena:', err);
          }

          
      } catch (error: any) {
        enqueueSnackBar(error?.message, {
          variant: SnackBarVariant.Error,
        });
      }
    },
    [
      currentWorkspaceMember?.id,
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

  if (onboardingStatus !== OnboardingStatus.OngoingProfileCreation) {
    return null;
  }

  return (
    <>
      <Title noMarginTop>Create profile</Title>
      <SubTitle>How you'll be identified on the app.</SubTitle>
      <StyledContentContainer>
        <StyledSectionContainer>
          <H2Title title="Picture" />
          <ProfilePictureUploader />
        </StyledSectionContainer>
        <StyledSectionContainer>
          <H2Title
            title="Name"
            description="Your name as it will be displayed on the app"
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
                  label="First Name"
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
                  label="Last Name"
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
          title="Continue"
          onClick={handleSubmit(onSubmit)}
          disabled={!isValid || isSubmitting}
          fullWidth
        />
      </StyledButtonContainer>
    </>
  );
};
