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
import { PRICING_PLAN_CONTENT_BY_ID, PRICING_PLANS } from 'twenty-shared';
import { ActionLink, Loader, MainButton, Pill } from 'twenty-ui';
import { getPostAuthLandingAppPath } from '~/config';
import { OnboardingStatus } from '~/generated/graphql';
import { Mixpanel } from '~/mixpanel';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

const StyledPanel = styled.div`
  width: 100%;
`;

const CORPORATE_PLAN_ID = 'corporate' as const;
const corporatePlanContent = PRICING_PLAN_CONTENT_BY_ID[CORPORATE_PLAN_ID];
const corporatePlan = PRICING_PLANS[CORPORATE_PLAN_ID];

const StyledEyebrow = styled.div`
  color: ${({ theme }) => theme.color.turquoise60};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  letter-spacing: 0.08em;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  text-transform: uppercase;
`;

const StyledHero = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  max-width: 760px;
`;

const StyledTitle = styled(Title)`
  text-align: left;
`;

const StyledSubTitle = styled(SubTitle)`
  font-size: ${({ theme }) => theme.font.size.xl};
  line-height: 1.5;
  text-align: left;
`;

const StyledNotes = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.7;
  max-width: 760px;
`;

const StyledSummaryGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: 1.2fr 0.8fr;
  margin-top: ${({ theme }) => theme.spacing(6)};
  width: 100%;

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const StyledValueCard = styled.div`
  background: ${({ theme }) =>
    `linear-gradient(180deg, ${theme.color.turquoise10} 0%, ${theme.background.primary} 100%)`};
  border: 2px solid ${({ theme }) => theme.color.turquoise60};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledValueTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledValueCopy = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.7;
`;

const StyledNextStepCard = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledNextStepTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledNextStepCopy = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.7;
`;

const StyledActionArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-top: auto;
`;

const StyledSkipRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledPill = styled(Pill)`
  align-self: flex-start;
  background: ${({ theme }) => theme.color.turquoise10};
  color: ${({ theme }) => theme.color.turquoise60};
`;

export const CorporateTaOnboarding = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setCurrentUser = useSetRecoilState(currentUserState);
  const onboardingStatus = useOnboardingStatus();

  const [completeIntentPath, { loading }] = useMutation(
    COMPLETE_ONBOARDING_INTENT_PATH_STEP,
  );

  const finishToHome = async () => {
    await completeIntentPath();

    Mixpanel.track('onboarding_step', {
      stepName: 'corporate_ta_path_completed',
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

  if (
    onboardingStatus !== OnboardingStatus.CORPORATE_TA &&
    location.pathname !== AppPath.CorporateTaOnboarding
  ) {
    return null;
  }

  return (
    <OnboardingIntentModalLayout panelWidth="xl">
      <StyledPanel data-testid="onboarding-path-corporate-ta">
        <StyledEyebrow>{corporatePlanContent.onboardingTitle}</StyledEyebrow>
        <StyledHero>
          <StyledTitle noMarginTop>{corporatePlan.label}</StyledTitle>
          <StyledSubTitle>{corporatePlan.tagline}</StyledSubTitle>
        </StyledHero>
        <StyledNotes>{corporatePlanContent.onboardingBody}</StyledNotes>

        <StyledSummaryGrid>
          <StyledValueCard>
            <StyledPill label={corporatePlan.mapTypeLabel} />
            <StyledValueTitle>
              Map your org and your competitors side by side.
            </StyledValueTitle>
            <StyledValueCopy>
              Run bulk talent maps across the companies you care about, then
              compare team shape, leadership coverage, and functional depth in
              one place.
            </StyledValueCopy>
            <OnboardingPricingPlanFeatures
              planId={CORPORATE_PLAN_ID}
              showInheritedLine
            />
          </StyledValueCard>

          <StyledNextStepCard>
            <StyledPill label="Get started" />
            <StyledNextStepTitle>Jump into the workspace</StyledNextStepTitle>
            <StyledNextStepCopy>
              Start mapping the first set of competitors and benchmark your own
              team. You can invite the rest of TA later from the workspace
              settings.
            </StyledNextStepCopy>
            <StyledActionArea>
              <MainButton
                title="Go to my workspace"
                onClick={finishToHome}
                disabled={loading}
                Icon={() => (loading ? <Loader /> : undefined)}
                fullWidth
              />
            </StyledActionArea>
          </StyledNextStepCard>
        </StyledSummaryGrid>

        <StyledSkipRow>
          <ActionLink onClick={finishToHome}>Skip for now</ActionLink>
        </StyledSkipRow>
      </StyledPanel>
    </OnboardingIntentModalLayout>
  );
};
