import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { getOSName, getSystemInfo } from '@/candidate-table/utils/arxena-app-download';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
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
  const [systemInfo, setSystemInfo] = useState<{ os: string; arch: string } | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const onboardingStatus = useOnboardingStatus();
  const isInstallAppStep = onboardingStatus === OnboardingStatus?.INSTALL_ARXENA_APP;

  useEffect(() => {
    setSystemInfo(getSystemInfo());
  }, []);

  const handleDownload = useCallback(async () => {
    if (!systemInfo) return;
    setIsDownloading(true);
    try {
      // Download has been disabled from onboarding flow
      // triggerArxenaAppDownload(systemInfo);
    } finally {
      setIsDownloading(false);
    }
  }, [advanceToNextStep, systemInfo]);

  const handleSkip = useCallback(async () => {}, []);

  if (onboardingStatus === undefined || onboardingStatus === null) {
    return <Loader />;
  }

  if (!isInstallAppStep) {
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
