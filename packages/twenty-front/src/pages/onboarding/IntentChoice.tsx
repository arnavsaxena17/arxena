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
import { isDefined } from 'twenty-shared';
import {
  ActionLink,
  AnimatedEaseIn,
  IconPhone,
  IconSearch,
  IconUsers,
  Loader,
  Pill,
  ProgressBar,
  ThemeType,
} from 'twenty-ui';
import { OnboardingIntentPath, OnboardingStatus } from '~/generated/graphql';
import { Mixpanel } from '~/mixpanel';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

type IntentTone = 'green' | 'purple' | 'orange';

const getAccentColor = (theme: ThemeType, tone: IntentTone) => {
  switch (tone) {
    case 'green':
      return theme.color.green60;
    case 'purple':
      return theme.color.purple60;
    case 'orange':
      return theme.color.orange60;
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
  }
};

const StyledPanel = styled.div`
  width: 100%;
`;

const StyledProgressBar = styled(ProgressBar)`
  > div {
    background-color: ${({ theme }) => theme.color.blue};
  }

  border-radius: ${({ theme }) => theme.border.radius.pill};
  margin-bottom: ${({ theme }) => theme.spacing(5)};
  opacity: 0.9;
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSubTitle = styled(SubTitle)`
  font-size: ${({ theme }) => theme.font.size.xl};
  line-height: 1.45;
  max-width: 700px;
  text-align: left;
`;

const StyledIntroCopy = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.7;
  margin-top: ${({ theme }) => theme.spacing(2)};
  max-width: 720px;
`;

const StyledChoices = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing(6)};
  width: 100%;

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
`;

const StyledChoiceCard = styled.button<{
  tone: IntentTone;
}>`
  background: ${({ theme, tone }) => getAccentBackground(theme, tone)};
  border: 2px solid ${({ theme, tone }) => getAccentColor(theme, tone)};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  min-height: 280px;
  padding: ${({ theme }) => theme.spacing(5)};
  text-align: left;
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
  gap: ${({ theme }) => theme.spacing(3)};
  justify-content: space-between;
`;

const StyledChoiceHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
  min-width: 0;
`;

const StyledChoiceTitleRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledChoiceTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.25;
`;

const StyledChoiceMeta = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.55;
`;

const StyledChoiceIcon = styled.div<{ tone: IntentTone }>`
  align-items: center;
  color: ${({ theme, tone }) => getAccentColor(theme, tone)};
  display: flex;
  justify-content: center;
  min-width: 28px;
`;

const StyledChoiceDescription = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.65;
`;

const StyledChoiceHint = styled.div<{ tone: IntentTone }>`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme, tone }) => getAccentColor(theme, tone)};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1.6;
  margin-top: auto;
  padding: ${({ theme }) => theme.spacing(3)};
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
  margin-top: ${({ theme }) => theme.spacing(4)};
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
  [OnboardingIntentPath.DEAL_DILIGENCE]: {
    appPath: AppPath.DealDiligenceOnboarding,
    onboardingStatus: OnboardingStatus.DEAL_DILIGENCE,
  },
} as const;

const intentCards = {
  [OnboardingIntentPath.EXTENSION_INSTALL]: {
    title: 'Building my team',
    persona: 'Founder / Recruiter',
    description:
      'Finding candidates at specific companies to hire, with extension-powered sourcing and fast org chart delivery.',
    hint: '→ Self-serve · install extension · org chart in 2 hrs · credits',
    Icon: IconUsers,
    tone: 'green',
  },
  [OnboardingIntentPath.COMPETITIVE_RESEARCH]: {
    title: 'Competitive research',
    persona: 'Operator',
    description:
      'Understanding how competitor teams are structured, with the choice to self-serve or book a guided walkthrough.',
    hint: '→ Your choice: self-serve OR book a 20-min live walkthrough',
    Icon: IconSearch,
    tone: 'purple',
  },
  [OnboardingIntentPath.DEAL_DILIGENCE]: {
    title: 'Investment / deal diligence',
    persona: 'PE / VC',
    description:
      'Mapping management teams for a fund or acquisition, and booking a live session to review a target company.',
    hint: '→ Book a call — we’ll map a target company live on the session',
    Icon: IconPhone,
    tone: 'orange',
  },
} as const;

type IntentChoiceProps = {
  showProgressBar?: boolean;
};

export const IntentChoice = ({ showProgressBar = true }: IntentChoiceProps) => {
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

    navigate(AppPath.Jobs, { replace: true });
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
    <OnboardingIntentModalLayout panelWidth="xl">
      <StyledPanel data-testid="onboarding-intent-choice">
        {showProgressBar ? <StyledProgressBar value={56} /> : null}
        <AnimatedEaseIn>
          <Logo secondaryLogo={workspacePublicData?.logo} />
        </AnimatedEaseIn>
        <StyledHeader>
          <Title animate>What brings you here?</Title>
          <StyledSubTitle>
            We&apos;ll personalise your experience. One click. No wrong answer.
          </StyledSubTitle>
          <StyledIntroCopy>
            Choose the workflow that best matches what you want from Arxena
            right now. We&apos;ll tailor the next step, whether that means
            self-serve setup, a guided walkthrough, or a live diligence session.
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
                  <StyledChoiceHeading>
                    <StyledChoiceTitleRow>
                      <StyledChoiceTitle>{card.title}</StyledChoiceTitle>
                      <StyledPill label={card.persona} tone={card.tone} />
                    </StyledChoiceTitleRow>
                    <StyledChoiceMeta>{card.description}</StyledChoiceMeta>
                  </StyledChoiceHeading>
                  <StyledChoiceIcon tone={card.tone}>
                    <CardIcon size={22} stroke={1.8} />
                  </StyledChoiceIcon>
                </StyledChoiceHeader>
                <StyledChoiceDescription>
                  {path === OnboardingIntentPath.EXTENSION_INSTALL &&
                    'Self-serve candidate sourcing with the extension, rapid org chart delivery, and credits to get started.'}
                  {path === OnboardingIntentPath.COMPETITIVE_RESEARCH &&
                    'Compare competitor team structure with either a self-serve path or a guided 20-minute walkthrough.'}
                  {path === OnboardingIntentPath.DEAL_DILIGENCE &&
                    'Review a target company with us live so your fund or acquisition team can move faster with context.'}
                </StyledChoiceDescription>
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
