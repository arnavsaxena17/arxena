import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Key } from 'ts-key-enum';
import { H2Title, Loader, MainButton } from 'twenty-ui';
import { z } from 'zod';

import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useAuth } from '@/auth/hooks/useAuth';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { WorkspaceLogoUploader } from '@/settings/workspace/components/WorkspaceLogoUploader';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInputV2 } from '@/ui/input/components/TextInputV2';
import { Trans, useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared';
import {
  OnboardingStatus,
  useActivateWorkspaceMutation,
} from '~/generated/graphql';
import { START_TRIAL } from '~/modules/billing/graphql/startTrial';

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

export const CreateWorkspace = () => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const onboardingStatus = useOnboardingStatus();
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const trialStartedRef = useRef(false);

  const { loadCurrentUser } = useAuth();
  const [activateWorkspace] = useActivateWorkspaceMutation();
  const [startTrial, { loading: isStartingTrial }] = useMutation(START_TRIAL);

  // When user lands with PLAN_REQUIRED, auto-start 7-day trial (no Stripe redirect) so they go straight to Create Workspace
  useEffect(() => {
    if (
      onboardingStatus !== OnboardingStatus.PLAN_REQUIRED ||
      trialStartedRef.current
    ) {
      return;
    }
    trialStartedRef.current = true;
    startTrial()
      .then((result) => {
        if (result.data?.startTrial?.success) {
          return loadCurrentUser();
        }
      })
      .catch(() => {
        trialStartedRef.current = false;
      });
  }, [onboardingStatus, startTrial, loadCurrentUser]);

  const validationSchema = z
    .object({
      name: z.string().min(1, { message: t`Name can not be empty` }),
    })
    .required();

  type Form = z.infer<typeof validationSchema>;

  // Form
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<Form>({
    mode: 'onChange',
    defaultValues: {
      name: '',
    },
    resolver: zodResolver(validationSchema),
  });

  const onSubmit: SubmitHandler<Form> = useCallback(
    async (data) => {
      try {
        const result = await activateWorkspace({
          variables: {
            input: {
              displayName: data.name,
            },
          },
        });

        if (isDefined(result.errors)) {
          throw result.errors ?? new Error(t`Unknown error`);
        }
        await loadCurrentUser();
        setNextOnboardingStatus();
      } catch (error: any) {
        console.log('ERROR', error);
        // enqueueSnackBar(error?.message, {
        //   variant: SnackBarVariant.Error,
        // });
      }
    },
    [
      activateWorkspace,
      enqueueSnackBar,
      loadCurrentUser,
      setNextOnboardingStatus,
      t,
    ],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === Key.Enter) {
      event.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  if (onboardingStatus === OnboardingStatus.PLAN_REQUIRED) {
    return (
      <>
        <Title noMarginTop>
          <Trans>Create your workspace</Trans>
        </Title>
        <SubTitle>
          <Trans>Starting your free trial…</Trans>
        </SubTitle>
        <Loader />
      </>
    );
  }

  if (onboardingStatus !== OnboardingStatus.WORKSPACE_ACTIVATION) {
    return null;
  }

  return (
    <>
      <Title noMarginTop>
        <Trans>Create your workspace</Trans>
      </Title>
      <SubTitle>
        <Trans>
          A shared environment where you will be able to manage your customer
          relations with your team.
        </Trans>
      </SubTitle>
      <StyledContentContainer>
        <StyledSectionContainer>
          <H2Title title={t`Workspace logo`} />
          <WorkspaceLogoUploader />
        </StyledSectionContainer>
        <StyledSectionContainer>
          <H2Title
            title={t`Workspace name`}
            description={t`The name of your organization`}
          />
          <Controller
            name="name"
            control={control}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { error },
            }) => (
              <TextInputV2
                autoFocus
                value={value}
                placeholder="Apple"
                onBlur={onBlur}
                onChange={onChange}
                error={error?.message}
                onKeyDown={handleKeyDown}
                fullWidth
              />
            )}
          />
        </StyledSectionContainer>
      </StyledContentContainer>
      <StyledButtonContainer>
        <MainButton
          title={t`Continue`}
          onClick={handleSubmit(onSubmit)}
          disabled={!isValid || isSubmitting}
          Icon={() => isSubmitting && <Loader />}
          fullWidth
        />
      </StyledButtonContainer>
    </>
  );
};
