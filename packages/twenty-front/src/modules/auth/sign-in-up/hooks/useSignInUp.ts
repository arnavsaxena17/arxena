import { useCallback, useState } from 'react';
import { SubmitHandler, UseFormReturn } from 'react-hook-form';
import { useParams, useSearchParams } from 'react-router-dom';

import { Form } from '@/auth/sign-in-up/hooks/useSignInUpForm';
import { signInUpModeState } from '@/auth/states/signInUpModeState';
import {
    SignInUpStep,
    signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { SignInUpMode } from '@/auth/types/signInUpMode';
import { useReadCaptchaToken } from '@/captcha/hooks/useReadCaptchaToken';
import { useRequestFreshCaptchaToken } from '@/captcha/hooks/useRequestFreshCaptchaToken';
import { AppPath } from '@/types/AppPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useRecoilState } from 'recoil';
import {
    isAllowedEmailForNewWorkspaceSignup,
    isDefined,
    WORK_EMAIL_REQUIRED_MESSAGE,
} from 'twenty-shared';
import { useIsMatchingLocation } from '~/hooks/useIsMatchingLocation';
import { useAuth } from '../../hooks/useAuth';

export const useSignInUp = (form: UseFormReturn<Form>) => {
  const { enqueueSnackBar } = useSnackBar();

  const [signInUpStep, setSignInUpStep] = useRecoilState(signInUpStepState);
  const [signInUpMode, setSignInUpMode] = useRecoilState(signInUpModeState);

  const { isMatchingLocation } = useIsMatchingLocation();

  const workspaceInviteHash = useParams().workspaceInviteHash;
  const [searchParams] = useSearchParams();
  const workspacePersonalInviteToken =
    searchParams.get('inviteToken') ?? undefined;

  const [isInviteMode] = useState(() => isMatchingLocation(AppPath.Invite));

  const isJoiningExistingWorkspace =
    isInviteMode ||
    isDefined(workspaceInviteHash) ||
    isDefined(workspacePersonalInviteToken);

  const {
    signInWithCredentials,
    signUpWithCredentials,
    checkUserExists: { checkUserExistsQuery },
  } = useAuth();

  const { requestFreshCaptchaToken } = useRequestFreshCaptchaToken();
  const { readCaptchaToken } = useReadCaptchaToken();

  const continueWithEmail = useCallback(() => {
    requestFreshCaptchaToken();
    setSignInUpStep(SignInUpStep.Email);
  }, [requestFreshCaptchaToken, setSignInUpStep]);

  const continueWithCredentials = useCallback(async () => {
    const token = await readCaptchaToken();
    if (!form.getValues('email')) {
      return;
    }
    checkUserExistsQuery({
      variables: {
        email: form.getValues('email').toLowerCase().trim(),
        captchaToken: token,
      },
      onError: (error) => {
        enqueueSnackBar(`${error.message}`, {
          variant: SnackBarVariant.Error,
        });
      },
      onCompleted: (data) => {
        requestFreshCaptchaToken();
        const email = form.getValues('email').toLowerCase().trim();
        if (
          !data?.checkUserExists.exists &&
          !isJoiningExistingWorkspace &&
          !isAllowedEmailForNewWorkspaceSignup(email)
        ) {
          enqueueSnackBar(WORK_EMAIL_REQUIRED_MESSAGE, {
            variant: SnackBarVariant.Error,
          });
          return;
        }
        if (data?.checkUserExists.exists) {
          setSignInUpMode(SignInUpMode.SignIn);
        } else {
          setSignInUpMode(SignInUpMode.SignUp);
        }
        setSignInUpStep(SignInUpStep.Password);
      },
    });
  }, [
    readCaptchaToken,
    form,
    checkUserExistsQuery,
    enqueueSnackBar,
    requestFreshCaptchaToken,
    setSignInUpStep,
    setSignInUpMode,
    isJoiningExistingWorkspace,
  ]);

  const submitCredentials: SubmitHandler<Form> = useCallback(
    async (data) => {
      const token = await readCaptchaToken();
      try {
        if (!data.email || !data.password) {
          throw new Error('Email and password are required');
        }

        if (signInUpMode === SignInUpMode.SignIn && !isInviteMode) {
          await signInWithCredentials(
            data.email.toLowerCase().trim(),
            data.password,
            token,
          );
        } else {
          const email = data.email.toLowerCase().trim();
          if (
            !isJoiningExistingWorkspace &&
            !isAllowedEmailForNewWorkspaceSignup(email)
          ) {
            enqueueSnackBar(WORK_EMAIL_REQUIRED_MESSAGE, {
              variant: SnackBarVariant.Error,
            });
            requestFreshCaptchaToken();
            return;
          }
          await signUpWithCredentials(
            email,
            data.password,
            workspaceInviteHash,
            workspacePersonalInviteToken,
            token,
          );
        }
      } catch (err: any) {
        enqueueSnackBar(err?.message, {
          variant: SnackBarVariant.Error,
        });
        requestFreshCaptchaToken();
      }
    },
    [
      readCaptchaToken,
      signInUpMode,
      isInviteMode,
      isJoiningExistingWorkspace,
      signInWithCredentials,
      signUpWithCredentials,
      workspaceInviteHash,
      workspacePersonalInviteToken,
      enqueueSnackBar,
      requestFreshCaptchaToken,
    ],
  );

  return {
    isInviteMode,
    signInUpStep,
    signInUpMode,
    continueWithCredentials,
    continueWithEmail,
    submitCredentials,
  };
};
