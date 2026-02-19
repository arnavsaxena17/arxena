import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { currentUserState } from '@/auth/states/currentUserState';
import {
  getOSName,
  getSystemInfo,
  triggerArxenaAppDownload,
} from '@/candidate-table/utils/arxena-app-download';
import { SKIP_INSTALL_APP_ONBOARDING_STEP } from '@/onboarding/graphql/mutations/skipInstallAppOnboardingStep';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { ActionLink, LightButton, MainButton } from 'twenty-ui';
import { OnboardingStatus } from '~/generated/graphql';

const StyledContentContainer = styled.div`
  width: 100%;
`;

const StyledSectionContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledButtonContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
  margin-left: auto;
  margin-right: auto;
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSkipContainer = styled.div`
  margin: ${({ theme }) => theme.spacing(3)} 0 0;
  display: flex;
  justify-content: center;
`;

export const InstallApp = () => {
  const { t } = useLingui();
  const currentUser = useRecoilValue(currentUserState);
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const [skipInstallAppOnboardingStep] = useMutation(
    SKIP_INSTALL_APP_ONBOARDING_STEP,
  );

  const [systemInfo, setSystemInfo] = useState<{ os: string; arch: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSystemInfo(getSystemInfo());
    } catch {
      setError('Failed to detect system');
    }
  }, []);

  const advanceStep = useCallback(async () => {
    await skipInstallAppOnboardingStep();
    setNextOnboardingStatus();
  }, [skipInstallAppOnboardingStep, setNextOnboardingStatus]);

  const handleDownloadAndContinue = useCallback(() => {
    if (systemInfo) {
      try {
        triggerArxenaAppDownload(systemInfo);
      } catch {
        setError('Failed to start download');
        return;
      }
    }
    advanceStep();
  }, [systemInfo, advanceStep]);

  const handleSkip = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  if (currentUser?.onboardingStatus !== OnboardingStatus.INSTALL_APP) {
    return null;
  }

  return (
    <>
      <Title noMarginTop>
        <Trans>Install Arxena App</Trans>
      </Title>
      <SubTitle>
        <Trans>
          Install the Arxena desktop app for the best experience. You can skip
          this step and install later.
        </Trans>
      </SubTitle>
      <StyledContentContainer>
        <StyledSectionContainer>
          {error && (
            <StyledSectionContainer style={{ color: 'var(--color-red-500)' }}>
              {error}
            </StyledSectionContainer>
          )}
          {systemInfo && (
            <StyledButtonContainer>
              <MainButton
                title={
                  systemInfo.os
                    ? t`Download for ${getOSName(systemInfo.os)}`
                    : t`Download Arxena App`
                }
                onClick={handleDownloadAndContinue}
                fullWidth
              />
              <LightButton
                title={t`Continue without downloading`}
                accent="tertiary"
                onClick={advanceStep}
              />
            </StyledButtonContainer>
          )}
        </StyledSectionContainer>
      </StyledContentContainer>
      <StyledSkipContainer>
        <ActionLink onClick={handleSkip}>
          <Trans>Skip</Trans>
        </ActionLink>
      </StyledSkipContainer>
    </>
  );
};
