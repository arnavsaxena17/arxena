import { tokenPairState } from '@/auth/states/tokenPairState';
import { useWaitForChromeExtensionInstalled } from '@/chrome-extension/hooks/useWaitForChromeExtensionInstalled';
import { OnboardingSkipButton } from '@/onboarding/components/OnboardingSkipButton';
import { OnboardingStepAnimatedItem } from '@/onboarding/components/OnboardingStepAnimatedItem';
import { StyledOnboardingStepHeading } from '@/onboarding/components/StyledOnboardingStepHeading';
import { StyledOnboardingStepPage } from '@/onboarding/components/StyledOnboardingStepPage';
import { StyledOnboardingStepSubtitle } from '@/onboarding/components/StyledOnboardingStepSubtitle';
import { StyledOnboardingStepTitle } from '@/onboarding/components/StyledOnboardingStepTitle';
import { ONBOARDING_CONTENT_BLOCK_WIDTH } from '@/onboarding/constants/OnboardingContentBlockWidth';
import { useCompleteChromeExtensionOnboardingStep } from '@/onboarding/hooks/useCompleteChromeExtensionOnboardingStep';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { pushChromeExtensionAuthToContentScript } from '@/unipile/utils/linkedinUnipileExtensionBridge';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared/constants';
import { IconBrowserMaximize, IconCheck } from 'twenty-ui/icon';
import { MainButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledSubtitle = styled(StyledOnboardingStepSubtitle)`
  max-width: 100%;
  width: ${ONBOARDING_CONTENT_BLOCK_WIDTH}px;
`;

const StyledFooter = styled.div`
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-width: 100%;
  width: ${ONBOARDING_CONTENT_BLOCK_WIDTH}px;
`;

const StyledInstallButton = styled.div`
  width: 100%;

  :global(.dark) button {
    --main-button-bg: var(--t-color-blue);
    --main-button-border-color: var(--t-color-blue);
    --main-button-color: var(--t-font-color-white);
    --main-button-hover-bg: var(--t-color-blue10);
  }
`;

const StyledStatus = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  margin: 0;
  width: 100%;
`;

export const ExtensionInstallOnboarding = () => {
  const { t } = useLingui();
  const { isExtensionInstalled, isChecking } =
    useWaitForChromeExtensionInstalled();
  const completeChromeExtensionOnboardingStep =
    useCompleteChromeExtensionOnboardingStep();
  const tokenPair = useAtomStateValue(tokenPairState);
  const [isCompleting, setIsCompleting] = useState(false);
  // oxlint-disable-next-line twenty/no-state-useref
  const hasAutoCompletedRef = useRef(false);

  const pushAuthTokenToExtension = useCallback(() => {
    const authToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
    pushChromeExtensionAuthToContentScript(authToken, window.location.origin);
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  const completeStep = useCallback(async () => {
    setIsCompleting(true);
    try {
      pushAuthTokenToExtension();
      await completeChromeExtensionOnboardingStep();
    } catch {
      setIsCompleting(false);
    }
  }, [completeChromeExtensionOnboardingStep, pushAuthTokenToExtension]);

  useEffect(() => {
    if (!isExtensionInstalled || hasAutoCompletedRef.current || isCompleting) {
      return;
    }
    hasAutoCompletedRef.current = true;
    void completeStep();
  }, [completeStep, isCompleting, isExtensionInstalled]);

  const handleInstallExtension = () => {
    window.open(ARXENA_CHROME_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
  };

  const handleContinue = () => {
    if (!isExtensionInstalled) {
      return;
    }
    void completeStep();
  };

  const handleSkip = () => {
    void completeStep();
  };

  const statusLabel = isExtensionInstalled
    ? t`Extension detected. Continuing…`
    : isChecking
      ? t`Checking for the Arx Chrome extension…`
      : t`Waiting for the extension to be installed.`;

  return (
    <StyledOnboardingStepPage>
      <StyledOnboardingStepHeading>
        <OnboardingStepAnimatedItem index={0}>
          <StyledOnboardingStepTitle>
            {t`Install the Arx Chrome extension`}
          </StyledOnboardingStepTitle>
        </OnboardingStepAnimatedItem>
        <OnboardingStepAnimatedItem index={1}>
          <StyledSubtitle>
            {t`Install the extension to sync LinkedIn and use sourcing tools. We'll continue automatically once it's installed.`}
          </StyledSubtitle>
        </OnboardingStepAnimatedItem>
      </StyledOnboardingStepHeading>

      <OnboardingStepAnimatedItem index={2}>
        <StyledFooter>
          <StyledInstallButton>
            <MainButton
              title={isExtensionInstalled ? t`Continue` : t`Install extension`}
              onClick={
                isExtensionInstalled ? handleContinue : handleInstallExtension
              }
              Icon={isExtensionInstalled ? IconCheck : IconBrowserMaximize}
              disabled={isCompleting}
              fullWidth
            />
          </StyledInstallButton>
          <StyledStatus>{statusLabel}</StyledStatus>
          <OnboardingSkipButton onClick={handleSkip} disabled={isCompleting} />
        </StyledFooter>
      </OnboardingStepAnimatedItem>
    </StyledOnboardingStepPage>
  );
};
