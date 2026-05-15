import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { currentUserState } from '@/auth/states/currentUserState';
import { OnboardingPricingPlanFeatures } from '@/onboarding/components/OnboardingPricingPlanFeatures';
import { COMPLETE_ONBOARDING_INTENT_PATH_STEP } from '@/onboarding/graphql/mutations/completeOnboardingIntentPathStep';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { AppPath } from '@/types/AppPath';
import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { ARXENA_CHROME_WEBSTORE_URL, PRICING_PLAN_CONTENT_BY_ID } from 'twenty-shared';
import { ActionLink, Loader, MainButton } from 'twenty-ui';
import { getPostAuthLandingAppPath } from '~/config';
import { OnboardingStatus } from '~/generated/graphql';
import { Mixpanel } from '~/mixpanel';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

const StyledActionColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-top: ${({ theme }) => theme.spacing(5)};
  width: 100%;
`;

const SALES_PLAN_ID = 'sales' as const;
const salesPlanContent = PRICING_PLAN_CONTENT_BY_ID[SALES_PLAN_ID];

const StyledFeaturesWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledSkipRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

export const ExtensionInstallOnboarding = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setCurrentUser = useSetRecoilState(currentUserState);
  const onboardingStatus = useOnboardingStatus();
  const [completeIntentPath, { loading }] = useMutation(
    COMPLETE_ONBOARDING_INTENT_PATH_STEP,
  );

  const finishToJobs = async () => {
    await completeIntentPath();

    Mixpanel.track('onboarding_step', {
      stepName: 'extension_install_path_completed',
    });

    setCurrentUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            onboardingStatus: OnboardingStatus.COMPLETED,
          }
        : currentUser,
    );

    navigate(getPostAuthLandingAppPath(), { replace: true });
  };

  const handleInstallExtension = () => {
    Mixpanel.track('onboarding_step', {
      stepName: 'extension_install_open_store',
    });

    window.open(ARXENA_CHROME_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
  };

  if (
    onboardingStatus !== OnboardingStatus.EXTENSION_INSTALL &&
    location.pathname !== AppPath.ExtensionInstallOnboarding
  ) {
    return null;
  }

  return (
    <OnboardingIntentModalLayout>
      <div data-testid="onboarding-path-extension-install">
        <Title noMarginTop>{salesPlanContent.onboardingTitle}</Title>
        <SubTitle>{salesPlanContent.onboardingBody}</SubTitle>
        <StyledFeaturesWrap>
          <OnboardingPricingPlanFeatures
            planId={SALES_PLAN_ID}
            layout="column"
          />
        </StyledFeaturesWrap>
        <StyledActionColumn>
          <MainButton
            title="Install extension"
            onClick={handleInstallExtension}
            fullWidth
          />
          <MainButton
            title="Go to jobs"
            onClick={finishToJobs}
            disabled={loading}
            Icon={() => (loading ? <Loader /> : undefined)}
            fullWidth
            variant="secondary"
          />
        </StyledActionColumn>
        <StyledSkipRow>
          <ActionLink onClick={finishToJobs}>Skip for now</ActionLink>
        </StyledSkipRow>
      </div>
    </OnboardingIntentModalLayout>
  );
};
