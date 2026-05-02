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
    buildCalendlyUrlWithPrefill,
    formatCalendlyInviteeName,
} from 'twenty-shared';
import {
    ActionLink,
    IconPhone,
    IconTargetArrow,
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
  color: ${({ theme }) => theme.color.orange60};
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
    `linear-gradient(180deg, ${theme.color.orange10} 0%, ${theme.background.primary} 100%)`};
  border: 2px solid ${({ theme }) => theme.color.orange60};
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

const StyledValueList = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
  grid-template-columns: repeat(2, minmax(0, 1fr));
  line-height: 1.6;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledValueListItem = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledValueItemIcon = styled.div`
  color: ${({ theme }) => theme.color.orange60};
  display: flex;
`;

const StyledBookingCard = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledBookingCardTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledBookingCardCopy = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.7;
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
    `linear-gradient(180deg, ${theme.color.orange10} 0%, ${theme.background.primary} 100%)`};
  border: 1px solid ${({ theme }) => theme.color.orange20};
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

const StyledSidebarActions = styled.div`
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
  background: ${({ theme }) => theme.color.orange10};
  color: ${({ theme }) => theme.color.orange60};
`;

export const DealDiligenceOnboarding = () => {
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
          a1: 'Arxena app — Deal diligence onboarding',
        },
        utm: {
          source: 'arxena_app',
          medium: 'onboarding',
          campaign: 'deal_diligence',
        },
      }),
    [
      calendlyBaseUrl,
      currentUser?.email,
      currentUser?.firstName,
      currentUser?.lastName,
    ],
  );
  const [completeIntentPath, { loading }] = useMutation(
    COMPLETE_ONBOARDING_INTENT_PATH_STEP,
  );

  const finishToJobs = async () => {
    await completeIntentPath();

    Mixpanel.track('onboarding_step', {
      stepName: 'deal_diligence_path_completed',
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

  const handleBookCall = () => {
    Mixpanel.track('onboarding_step', {
      stepName: 'deal_diligence_book_call',
    });

    setIsCalendlyVisible(true);
  };

  if (
    onboardingStatus !== OnboardingStatus.DEAL_DILIGENCE &&
    location.pathname !== AppPath.DealDiligenceOnboarding
  ) {
    return null;
  }

  return (
    <OnboardingIntentModalLayout panelWidth="xl">
      <StyledPanel data-testid="onboarding-path-deal-diligence">
        <StyledEyebrow>Deal diligence path</StyledEyebrow>
        <StyledHero>
          <StyledTitle noMarginTop>
            {isCalendlyVisible
              ? 'Book a diligence walkthrough'
              : 'Deal diligence'}
          </StyledTitle>
          <StyledSubTitle>
            {isCalendlyVisible
              ? `Choose a time and we’ll map a target company live with you.`
              : `Mapping management teams for a fund or acquisition? Book a live session and we’ll walk a target company with you.`}
          </StyledSubTitle>
        </StyledHero>
        <StyledNotes>
          {isCalendlyVisible
            ? `Use the scheduler below to lock time with us, or continue to jobs if you’d rather come back later.`
            : `This path is built for investors and diligence teams who want a live readout of leadership structure, functional coverage, and org shape before moving deeper.`}
        </StyledNotes>

        {!isCalendlyVisible && (
          <StyledSummaryGrid>
            <StyledValueCard>
              <StyledPill label="Live target-company walkthrough" />
              <StyledValueTitle>
                Bring a company. We&apos;ll map the leadership team with you.
              </StyledValueTitle>
              <StyledValueCopy>
                Use a 20-minute session to pressure-test org structure, spot
                leadership gaps, and see how the company is actually wired
                before the next diligence step.
              </StyledValueCopy>
              <StyledValueList>
                <StyledValueListItem>
                  <StyledValueItemIcon>
                    <IconTargetArrow size={18} stroke={1.8} />
                  </StyledValueItemIcon>
                  Fund and acquisition use cases
                </StyledValueListItem>
                <StyledValueListItem>
                  <StyledValueItemIcon>
                    <IconTargetArrow size={18} stroke={1.8} />
                  </StyledValueItemIcon>
                  Live mapping of the target company
                </StyledValueListItem>
                <StyledValueListItem>
                  <StyledValueItemIcon>
                    <IconPhone size={18} stroke={1.8} />
                  </StyledValueItemIcon>
                  Strategic Q&amp;A during the session
                </StyledValueListItem>
                <StyledValueListItem>
                  <StyledValueItemIcon>
                    <IconPhone size={18} stroke={1.8} />
                  </StyledValueItemIcon>
                  Faster context for investment memos
                </StyledValueListItem>
              </StyledValueList>
            </StyledValueCard>

            <StyledBookingCard>
              <StyledPill label="20-minute session" />
              <StyledBookingCardTitle>
                Get on a call with Arxena
              </StyledBookingCardTitle>
              <StyledBookingCardCopy>
                We&apos;ll review a company live, show how the org chart is
                structured, and help you interpret what it means.
              </StyledBookingCardCopy>
              <StyledActionArea>
                <MainButton
                  title="Book a 20-minute session"
                  onClick={handleBookCall}
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
              </StyledActionArea>
            </StyledBookingCard>
          </StyledSummaryGrid>
        )}

        {isCalendlyVisible && (
          <>
            <StyledBookingLayout>
              <StyledBookingSidebar>
                <StyledPill label="Deal diligence booking" />
                <StyledSidebarTitle>
                  Schedule the live diligence session
                </StyledSidebarTitle>
                <StyledSidebarList>
                  <div>Share the company you want to review.</div>
                  <div>
                    We&apos;ll walk the leadership and functional coverage.
                  </div>
                  <div>Ask questions in real time while we map the org.</div>
                </StyledSidebarList>
                <StyledSidebarActions>
                  <MainButton
                    title="Go to jobs"
                    onClick={finishToJobs}
                    disabled={loading}
                    Icon={() => (loading ? <Loader /> : undefined)}
                    fullWidth
                    variant="secondary"
                  />
                </StyledSidebarActions>
              </StyledBookingSidebar>
              <StyledCalendlyContainer>
                <StyledCalendlyFrame
                  src={calendlyEmbedUrl}
                  title="Book a 20-minute session"
                  data-testid="deal-diligence-calendly-embed"
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
