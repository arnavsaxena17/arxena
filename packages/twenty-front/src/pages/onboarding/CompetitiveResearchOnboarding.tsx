import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { currentUserState } from '@/auth/states/currentUserState';
import { dealDiligenceCalendlyEmbedUrlState } from '@/client-config/states/dealDiligenceCalendlyEmbedUrlState';
import { COMPLETE_ONBOARDING_INTENT_PATH_STEP } from '@/onboarding/graphql/mutations/completeOnboardingIntentPathStep';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { AppPath } from '@/types/AppPath';
import { useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
    ARXENA_CHROME_WEBSTORE_URL,
    buildCalendlyUrlWithPrefill,
    formatCalendlyInviteeName,
} from 'twenty-shared';
import {
    ActionLink,
    IconBolt,
    IconPhone,
    Loader,
    MainButton,
    Pill,
} from 'twenty-ui';
import { getPostAuthLandingAppPath } from '~/config';
import { OnboardingStatus } from '~/generated/graphql';
import { Mixpanel } from '~/mixpanel';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

const DEFAULT_CALENDLY_URL = 'https://calendly.com/arxena';

const StyledPanel = styled.div`
  width: 100%;
`;

const StyledEyebrow = styled.div`
  color: ${({ theme }) => theme.color.purple60};
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

const StyledOptionsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing(6)};
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const StyledOptionCard = styled.div<{ highlighted?: boolean }>`
  background: ${({ highlighted, theme }) =>
    highlighted ? theme.color.purple10 : theme.background.primary};
  border: 2px solid
    ${({ highlighted, theme }) =>
      highlighted ? theme.color.purple60 : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  min-height: 100%;
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledOptionIcon = styled.div<{ tone: 'yellow' | 'purple' }>`
  color: ${({ theme, tone }) =>
    tone === 'yellow' ? theme.color.yellow60 : theme.color.purple60};
  display: flex;
`;

const StyledOptionTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledOptionCopy = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.7;
`;

const StyledOptionList = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  gap: ${({ theme }) => theme.spacing(1.5)};
  line-height: 1.6;
`;

const StyledActionArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-top: auto;
`;

const StyledBookingLayout = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  margin-top: ${({ theme }) => theme.spacing(6)};
  width: 100%;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const StyledBookingSidebar = styled.div`
  background: ${({ theme }) =>
    `linear-gradient(180deg, ${theme.color.purple10} 0%, ${theme.background.primary} 100%)`};
  border: 1px solid ${({ theme }) => theme.color.purple20};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledSidebarTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.35;
`;

const StyledSidebarList = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  line-height: 1.6;
`;

const StyledBookingActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2.5)};
  margin-top: auto;
`;

const StyledCalendlyContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  overflow: hidden;
  width: 100%;
`;

const StyledCalendlyFrame = styled.iframe`
  background: ${({ theme }) => theme.background.primary};
  border: 0;
  display: block;
  height: 720px;
  width: 100%;
`;

const StyledInlineActions = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledSkipRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledPill = styled(Pill)`
  align-self: flex-start;
  background: ${({ theme }) => theme.color.purple10};
  color: ${({ theme }) => theme.color.purple60};
`;

export const CompetitiveResearchOnboarding = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useRecoilValue(currentUserState);
  const setCurrentUser = useSetRecoilState(currentUserState);
  const onboardingStatus = useOnboardingStatus();
  const [isCalendlyVisible, setIsCalendlyVisible] = useState(false);
  const dealDiligenceCalendlyEmbedUrl = useRecoilValue(
    dealDiligenceCalendlyEmbedUrlState,
  )?.trim();
  const calendlyBaseUrl =
    dealDiligenceCalendlyEmbedUrl && dealDiligenceCalendlyEmbedUrl.length > 0
      ? dealDiligenceCalendlyEmbedUrl
      : DEFAULT_CALENDLY_URL;

  const calendlyEmbedUrl = useMemo(
    () =>
      buildCalendlyUrlWithPrefill(calendlyBaseUrl, {
        name: formatCalendlyInviteeName({
          firstName: currentUser?.firstName,
          lastName: currentUser?.lastName,
        }),
        email: currentUser?.email ?? undefined,
        customAnswers: {
          a1: 'Arxena app — Competitive research onboarding',
        },
        utm: {
          source: 'arxena_app',
          medium: 'onboarding',
          campaign: 'competitive_research',
        },
      }),
    [
      calendlyBaseUrl,
      currentUser?.email,
      currentUser?.firstName,
      currentUser?.lastName,
    ],
  );
  const [completeIntentPath, { loading: isCompletingIntentPath }] = useMutation(
    COMPLETE_ONBOARDING_INTENT_PATH_STEP,
  );

  const finishToJobs = async () => {
    await completeIntentPath();

    Mixpanel.track('onboarding_step', {
      stepName: 'competitive_research_path_completed',
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

  const handleMapItYourself = () => {
    Mixpanel.track('onboarding_step', {
      stepName: 'competitive_research_self_serve',
    });

    setCurrentUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            onboardingStatus: OnboardingStatus.EXTENSION_INSTALL,
          }
        : currentUser,
    );

    window.open(ARXENA_CHROME_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
    navigate(AppPath.ExtensionInstallOnboarding, { replace: true });
  };

  const handleBookCall = () => {
    Mixpanel.track('onboarding_step', {
      stepName: 'competitive_research_book_call',
    });

    setIsCalendlyVisible(true);
  };

  if (
    onboardingStatus !== OnboardingStatus.COMPETITIVE_RESEARCH &&
    location.pathname !== AppPath.CompetitiveResearchOnboarding
  ) {
    return null;
  }

  return (
    <OnboardingIntentModalLayout panelWidth="xl">
      <StyledPanel data-testid="onboarding-path-competitive-research">
        <StyledEyebrow>Competitive research path</StyledEyebrow>
        <StyledHero>
          <StyledTitle noMarginTop>
            {isCalendlyVisible
              ? `Let's map a target company live on the call`
              : 'Competitive research'}
          </StyledTitle>
          <StyledSubTitle>
            {isCalendlyVisible
              ? `Pick a time and we'll review a target company live together.`
              : `Understand how competitor teams are structured. Self-serve if you want
          to move fast, or book a live walkthrough with us.`}
          </StyledSubTitle>
        </StyledHero>
        <StyledNotes>
          {isCalendlyVisible
            ? `Book a 20-minute session below, or continue to jobs whenever you're ready.`
            : `Both paths deliver the same org chart. Choose between speed and live context depending on how much support you want alongside the data.`}
        </StyledNotes>

        {!isCalendlyVisible && (
          <StyledOptionsGrid>
            <StyledOptionCard>
              <StyledOptionIcon tone="yellow">
                <IconBolt size={30} stroke={1.7} />
              </StyledOptionIcon>
              <StyledOptionTitle>Map it yourself</StyledOptionTitle>
              <StyledOptionCopy>
                Full org chart delivered in 2 hours. Uses credits from your free
                allocation. No call needed.
              </StyledOptionCopy>
              <StyledOptionList>
                <div>✓ 487 people mapped</div>
                <div>✓ Names, titles, LinkedIn profiles</div>
                <div>✓ Engagement layer included</div>
                <div>✓ Ready in 2-4 hours</div>
              </StyledOptionList>
              <StyledActionArea>
                <MainButton
                  title="Map now — free (10 credits)"
                  onClick={handleMapItYourself}
                  disabled={isCompletingIntentPath}
                  fullWidth
                />
              </StyledActionArea>
            </StyledOptionCard>

            <StyledOptionCard highlighted>
              <StyledOptionIcon tone="purple">
                <IconPhone size={30} stroke={1.7} />
              </StyledOptionIcon>
              <StyledPill label="Recommended for first-time users" />
              <StyledOptionTitle>See it live — 20 min call</StyledOptionTitle>
              <StyledOptionCopy>
                We map the company during the call and walk you through what the
                org structure reveals about team strategy and hiring direction.
              </StyledOptionCopy>
              <StyledOptionList>
                <div>✓ Same org chart + live context</div>
                <div>✓ Strategic interpretation</div>
                <div>✓ Q&amp;A on what you&apos;re seeing</div>
                <div>✓ Best for first-time users</div>
              </StyledOptionList>
              <StyledActionArea>
                <MainButton
                  title="Book 20 minutes"
                  onClick={handleBookCall}
                  disabled={isCompletingIntentPath}
                  fullWidth
                />
                <MainButton
                  title="Go to jobs"
                  onClick={finishToJobs}
                  disabled={isCompletingIntentPath}
                  Icon={() => (isCompletingIntentPath ? <Loader /> : undefined)}
                  fullWidth
                  variant="secondary"
                />
              </StyledActionArea>
            </StyledOptionCard>
          </StyledOptionsGrid>
        )}

        {isCalendlyVisible && (
          <>
            <StyledBookingLayout>
              <StyledBookingSidebar>
                <StyledPill label="Competitive research live walkthrough" />
                <StyledSidebarTitle>
                  Choose a time and we&apos;ll map a target company together
                </StyledSidebarTitle>
                <StyledSidebarList>
                  <div>
                    We&apos;ll come prepared with the org chart context.
                  </div>
                  <div>You&apos;ll see the structure live during the call.</div>
                  <div>
                    We&apos;ll answer questions about strategy and team shape.
                  </div>
                </StyledSidebarList>
                <StyledBookingActions>
                  <MainButton
                    title="Go to jobs"
                    onClick={finishToJobs}
                    disabled={isCompletingIntentPath}
                    Icon={() =>
                      isCompletingIntentPath ? <Loader /> : undefined
                    }
                    fullWidth
                    variant="secondary"
                  />
                </StyledBookingActions>
              </StyledBookingSidebar>
              <StyledCalendlyContainer data-testid="competitive-research-calendly-modal">
                <StyledCalendlyFrame
                  src={calendlyEmbedUrl}
                  title="Let's map a target company live on the call"
                  data-testid="competitive-research-calendly-embed"
                />
              </StyledCalendlyContainer>
            </StyledBookingLayout>
            <StyledInlineActions>
              <ActionLink
                onClick={() => {
                  window.open(
                    calendlyEmbedUrl,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
              >
                Open booking in a new tab
              </ActionLink>
            </StyledInlineActions>
          </>
        )}

        <StyledSkipRow>
          <ActionLink onClick={finishToJobs}>Skip for now</ActionLink>
        </StyledSkipRow>
      </StyledPanel>
    </OnboardingIntentModalLayout>
  );
};
