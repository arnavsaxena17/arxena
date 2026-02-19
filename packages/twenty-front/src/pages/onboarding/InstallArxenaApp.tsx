import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import {
  getOSName,
  getSystemInfo,
  triggerArxenaAppDownload,
} from '@/candidate-table/utils/arxena-app-download';
import { SKIP_INSTALL_APP_ONBOARDING_STEP } from '@/onboarding/graphql/mutations/skipInstallAppOnboardingStep';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { ActionLink, Loader, MainButton } from 'twenty-ui';
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

export const InstallArxenaApp = () => {
  const { t } = useLingui();
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const [skipInstallAppOnboardingStep] = useMutation(
    SKIP_INSTALL_APP_ONBOARDING_STEP,
  );
  const [systemInfo, setSystemInfo] = useState<{ os: string; arch: string } | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const onboardingStatus = useOnboardingStatus();
  const isInstallAppStep = onboardingStatus === OnboardingStatus?.INSTALL_ARXENA_APP;

  // #region agent log
  fetch('http://127.0.0.1:7288/ingest/52cd5fe2-bcf6-4472-b235-3dcac07357d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7275da'},body:JSON.stringify({sessionId:'7275da',location:'InstallArxenaApp.tsx:render',message:'InstallArxenaApp status check',data:{onboardingStatus: onboardingStatus ?? 'undefined',isInstallAppStep,returningNull:!isInstallAppStep},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    setSystemInfo(getSystemInfo());
  }, []);

  const advanceToNextStep = useCallback(async () => {
    await skipInstallAppOnboardingStep();
    setNextOnboardingStatus();
    // Do not call loadCurrentUser() here — same as Connect LinkedIn skip: refetch
    // can overwrite Recoil with server status (e.g. COMPLETED) before we render
    // Sync Emails, leaving the page blank.
  }, [setNextOnboardingStatus, skipInstallAppOnboardingStep]);

  const handleDownload = useCallback(async () => {
    if (!systemInfo) return;
    setIsDownloading(true);
    try {
      triggerArxenaAppDownload(systemInfo);
      await advanceToNextStep();
    } finally {
      setIsDownloading(false);
    }
  }, [advanceToNextStep, systemInfo]);

  const handleSkip = useCallback(async () => {
    await advanceToNextStep();
  }, [advanceToNextStep]);

  if (onboardingStatus === undefined || onboardingStatus === null) {
    return <Loader />;
  }

  if (!isInstallAppStep) {
    // #region agent log
    fetch('http://127.0.0.1:7288/ingest/52cd5fe2-bcf6-4472-b235-3dcac07357d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7275da'},body:JSON.stringify({sessionId:'7275da',location:'InstallArxenaApp.tsx:guard',message:'Returning null - not INSTALL_APP step',data:{onboardingStatus: onboardingStatus ?? 'undefined'},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return null;
  }

  const osName = systemInfo ? getOSName(systemInfo.os) : '';

  return (
    <>
      <Title noMarginTop>
        <Trans>Install Arxena App</Trans>
      </Title>
      <SubTitle>
        <Trans>
          Download the Arxena desktop app for the best experience. You can skip
          this step and install later.
        </Trans>
      </SubTitle>
      <StyledContentContainer>
        <StyledSectionContainer>
          <StyledButtonContainer>
            <MainButton
              title={
                osName
                  ? t`Download for ${osName}`
                  : t`Download Arxena App`
              }
              onClick={handleDownload}
              fullWidth
              Icon={() => (isDownloading ? <Loader /> : undefined)}
              disabled={isDownloading}
            />
          </StyledButtonContainer>
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
