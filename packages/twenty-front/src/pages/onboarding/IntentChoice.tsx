import { Logo } from '@/auth/components/Logo';
import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useAuth } from '@/auth/hooks/useAuth';
import { currentUserState } from '@/auth/states/currentUserState';
import { workspacePublicDataState } from '@/auth/states/workspacePublicDataState';
import { COMPLETE_ONBOARDING_INTENT_PATH_STEP } from '@/onboarding/graphql/mutations/completeOnboardingIntentPathStep';
import { SUBMIT_ONBOARDING_INTENT_PATH } from '@/onboarding/graphql/mutations/submitOnboardingIntentPath';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { AppPath } from '@/types/AppPath';
import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { isDefined, PRICING_PLANS } from 'twenty-shared';
import {
  ActionLink,
  AnimatedEaseIn,
  IconBuildingSkyscraper,
  IconPhone,
  IconSearch,
  IconUsers,
  Loader,
  Pill,
  ThemeType,
} from 'twenty-ui';
import { getPostAuthLandingAppPath } from '~/config';
import { OnboardingIntentPath, OnboardingStatus } from '~/generated/graphql';
import { Mixpanel } from '~/mixpanel';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

type IntentTone = 'green' | 'purple' | 'orange' | 'blue';

const getAccentColor = (theme: ThemeType, tone: IntentTone) => {
  switch (tone) {
    case 'green':
      return theme.color.green60;
    case 'purple':
      return theme.color.purple60;
    case 'orange':
      return theme.color.orange60;
    case 'blue':
      return theme.color.blue60;
  }
};

const getAccentBackground = (theme: ThemeType, tone: IntentTone) => {
  switch (tone) {
    case 'green':
      return theme.color.green10;
    case 'purple':
      return theme.color.purple10;
    case 'orange':
      return theme.color.orange10;
    case 'blue':
      return theme.color.blue10;
  }
};

const StyledPanel = styled.div`
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  text-align: center;
  width: 100%;
`;

const StyledLogoRow = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledSubTitle = styled(SubTitle)`
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.4;
  margin-left: auto;
  margin-right: auto;
  max-width: 40ch;
  text-align: center;
`;

const StyledIntroCopy = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.45;
  margin-left: auto;
  margin-right: auto;
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  max-width: 44ch;
  text-align: center;
`;

const StyledChoices = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing(2)};
  width: 100%;

  @media (max-width: 1280px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledChoiceCard = styled.button<{
  tone: IntentTone;
}>`
  background: ${({ theme, tone }) => getAccentBackground(theme, tone)};
  border: 2px solid ${({ theme, tone }) => getAccentColor(theme, tone)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  min-height: 0;
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: center;
  transition:
    transform ${({ theme }) => theme.animation.duration.normal}ms ease,
    box-shadow ${({ theme }) => theme.animation.duration.normal}ms ease,
    border-color ${({ theme }) => theme.animation.duration.normal}ms ease;
  width: 100%;

  &:hover {
    box-shadow: ${({ theme }) => theme.boxShadow.strong};
    transform: translateY(-2px);
  }
`;

const StyledChoiceHeader = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  width: 100%;
`;

const StyledChoiceHeading = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 0;
  width: 100%;
`;

const StyledChoiceTitleRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1.5)};
  justify-content: center;
`;

const StyledChoiceTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.25;
`;

const StyledChoiceIcon = styled.div<{ tone: IntentTone }>`
  align-items: center;
  align-self: center;
  color: ${({ theme, tone }) => getAccentColor(theme, tone)};
  display: flex;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
  min-width: 28px;
`;

const StyledChoiceBody = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
`;

const StyledChoiceHint = styled.div<{ tone: IntentTone }>`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme, tone }) => getAccentColor(theme, tone)};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1.45;
  margin-top: auto;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledLoaderArea = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: ${({ theme }) => theme.spacing(40)};
  width: 100%;
`;

const StyledSkipRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const StyledPill = styled(Pill)<{
  tone: IntentTone;
}>`
  background: ${({ theme, tone }) => getAccentBackground(theme, tone)};
  border: 1px solid ${({ theme, tone }) => getAccentColor(theme, tone)};
  color: ${({ theme, tone }) => getAccentColor(theme, tone)};
  height: auto;
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const intentConfig = {
  [OnboardingIntentPath.EXTENSION_INSTALL]: {
    appPath: AppPath.ExtensionInstallOnboarding,
    onboardingStatus: OnboardingStatus.EXTENSION_INSTALL,
  },
  [OnboardingIntentPath.COMPETITIVE_RESEARCH]: {
    appPath: AppPath.CompetitiveResearchOnboarding,
    onboardingStatus: OnboardingStatus.COMPETITIVE_RESEARCH,
  },
  [OnboardingIntentPath.CORPORATE_TA]: {
    appPath: AppPath.CorporateTaOnboarding,
    onboardingStatus: OnboardingStatus.CORPORATE_TA,
  },
  [OnboardingIntentPath.DEAL_DILIGENCE]: {
    appPath: AppPath.DealDiligenceOnboarding,
    onboardingStatus: OnboardingStatus.DEAL_DILIGENCE,
  },
} as const;

const intentCards = {
  [OnboardingIntentPath.EXTENSION_INSTALL]: {
    title: PRICING_PLANS.sales.label,
    persona: 'Founder / Sales',
    body: PRICING_PLANS.sales.tagline,
    hint: 'Self-serve · extension · ~2 hr delivery',
    Icon: IconUsers,
    tone: 'green',
  },
  [OnboardingIntentPath.COMPETITIVE_RESEARCH]: {
    title: PRICING_PLANS.recruitment.label,
    persona: 'Recruiter',
    body: PRICING_PLANS.recruitment.tagline,
    hint: 'Self-serve or 20-min live walkthrough',
    Icon: IconSearch,
    tone: 'purple',
  },
  [OnboardingIntentPath.CORPORATE_TA]: {
    title: PRICING_PLANS.corporate.label,
    persona: 'Corporate TA',
    body: PRICING_PLANS.corporate.tagline,
    hint: 'Self-serve · multi-company maps',
    Icon: IconBuildingSkyscraper,
    tone: 'blue',
  },
  [OnboardingIntentPath.DEAL_DILIGENCE]: {
    title: PRICING_PLANS.investment.label,
    persona: 'PE / VC',
    body: PRICING_PLANS.investment.tagline,
    hint: 'Book a call · live company map',
    Icon: IconPhone,
    tone: 'orange',
  },
} as const;

export const IntentChoice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loadCurrentUser } = useAuth();
  const setCurrentUser = useSetRecoilState(currentUserState);
  const workspacePublicData = useRecoilValue(workspacePublicDataState);
  const onboardingStatus = useOnboardingStatus();
  const [hasBootstrappedIntent, setHasBootstrappedIntent] = useState(false);
  const [intentBootstrapFinished, setIntentBootstrapFinished] = useState(false);
  const [submitIntentPath, { loading }] = useMutation(
    SUBMIT_ONBOARDING_INTENT_PATH,
  );
  const [completeIntentPath, { loading: isSkipping }] = useMutation(
    COMPLETE_ONBOARDING_INTENT_PATH_STEP,
  );

  const isIntentRoute = location.pathname === AppPath.IntentChoice;

  useEffect(() => {
    if (!isIntentRoute) {
      setHasBootstrappedIntent(false);
      setIntentBootstrapFinished(false);
      return;
    }

    if (onboardingStatus === OnboardingStatus.INTENT_CHOICE) {
      return;
    }

    if (hasBootstrappedIntent) {
      return;
    }

    setHasBootstrappedIntent(true);

    void loadCurrentUser().finally(() => {
      setIntentBootstrapFinished(true);
    });
  }, [hasBootstrappedIntent, isIntentRoute, loadCurrentUser, onboardingStatus]);

  const waitingOnIntentBootstrap =
    isIntentRoute &&
    onboardingStatus !== OnboardingStatus.INTENT_CHOICE &&
    !intentBootstrapFinished;

  const handleSelect = async (path: OnboardingIntentPath) => {
    const nextStep = intentConfig[path];

    await submitIntentPath({ variables: { path } });

    Mixpanel.track('onboarding_step', {
      stepName: 'intent_choice',
      intentPath: path,
    });

    setCurrentUser((currentUser) => {
      if (!isDefined(currentUser)) {
        return currentUser;
      }

      return {
        ...currentUser,
        onboardingStatus: nextStep.onboardingStatus,
      };
    });

    navigate(nextStep.appPath, { replace: true });
  };

  const handleSkip = async () => {
    await completeIntentPath();

    setCurrentUser((currentUser) =>
      isDefined(currentUser)
        ? {
            ...currentUser,
            onboardingStatus: OnboardingStatus.COMPLETED,
          }
        : currentUser,
    );

    navigate(getPostAuthLandingAppPath(), { replace: true });
  };

  if (waitingOnIntentBootstrap) {
    return (
      <OnboardingIntentModalLayout>
        <StyledLoaderArea data-testid="onboarding-intent-choice-loading">
          <Loader />
        </StyledLoaderArea>
      </OnboardingIntentModalLayout>
    );
  }

  if (
    onboardingStatus !== OnboardingStatus.INTENT_CHOICE &&
    location.pathname !== AppPath.IntentChoice
  ) {
    return null;
  }

  return (
    <OnboardingIntentModalLayout panelWidth="lg">
      <StyledPanel data-testid="onboarding-intent-choice">
        <StyledLogoRow>
          <AnimatedEaseIn>
            <Logo secondaryLogo={workspacePublicData?.logo} />
          </AnimatedEaseIn>
        </StyledLogoRow>
        <StyledHeader>
          <Title animate denseSpacing noMarginTop>
            What brings you here?
          </Title>
          <StyledSubTitle>We&apos;ll personalise your experience</StyledSubTitle>
          <StyledIntroCopy>
            Choose a path—we&apos;ll match the next step to it.
          </StyledIntroCopy>
        </StyledHeader>
        <StyledChoices>
          {(
            Object.entries(intentCards) as Array<
              [OnboardingIntentPath, (typeof intentCards)[OnboardingIntentPath]]
            >
          ).map(([path, card]) => {
            const CardIcon = card.Icon;

            return (
              <StyledChoiceCard
                key={path}
                onClick={() => handleSelect(path)}
                disabled={loading || isSkipping}
                type="button"
                tone={card.tone}
              >
                <StyledChoiceHeader>
                  <StyledChoiceIcon tone={card.tone}>
                    <CardIcon size={20} stroke={1.8} />
                  </StyledChoiceIcon>
                  <StyledChoiceHeading>
                    <StyledChoiceTitleRow>
                      <StyledChoiceTitle>{card.title}</StyledChoiceTitle>
                      <StyledPill label={card.persona} tone={card.tone} />
                    </StyledChoiceTitleRow>
                  </StyledChoiceHeading>
                </StyledChoiceHeader>
                <StyledChoiceBody>{card.body}</StyledChoiceBody>
                <StyledChoiceHint tone={card.tone}>
                  {card.hint}
                </StyledChoiceHint>
              </StyledChoiceCard>
            );
          })}
        </StyledChoices>
        <StyledSkipRow>
          <ActionLink onClick={handleSkip}>Skip for now</ActionLink>
        </StyledSkipRow>
      </StyledPanel>
    </OnboardingIntentModalLayout>
  );
};
