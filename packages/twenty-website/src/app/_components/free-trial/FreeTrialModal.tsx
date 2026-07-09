'use client';

import styled from '@emotion/styled';
import { IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { CalendlyInline } from '@/app/_components/contact/CalendlyInline';
import { trackGA4Event } from '@/lib/analytics';
import { buildFreeTrialCalendlyUrl } from '@/lib/free-trial-calendly';
import { FREE_TRIAL_CTA_LABEL } from '@/lib/free-trial-flow';
import {
  FreeTrialLeadPayload,
  FreeTrialOrgChartContext,
  FreeTrialSource,
} from '@/lib/free-trial-types';
import { trackWebsiteEvent } from '@/lib/mixpanel';
import { submitCalendlyBookingCompleted } from '@/lib/submit-calendly-booking-completed';
import { OrgChartSignUpIntro } from 'twenty-orgchart/orgchart-core';
import {
  isAllowedEmailForNewWorkspaceSignup,
  OrgChartNodeData,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from 'twenty-shared';

type FreeTrialModalStep = 'intro' | 'form' | 'loading' | 'calendly' | 'success';

export type FreeTrialModalIntro = {
  node: OrgChartNodeData;
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

type FreeTrialModalProps = {
  isOpen: boolean;
  source: FreeTrialSource;
  orgChartContext?: FreeTrialOrgChartContext;
  intro?: FreeTrialModalIntro;
  onClose: () => void;
};

const getInitialStep = (intro?: FreeTrialModalIntro): FreeTrialModalStep =>
  intro ? 'intro' : 'form';

const StyledBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
`;

const StyledDialog = styled.div`
  position: relative;
  width: 100%;
  max-width: 960px;
  max-height: min(92vh, 900px);
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
`;

const StyledFormDialog = styled(StyledDialog)`
  max-width: 440px;
`;

const StyledCloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #818181;
  cursor: pointer;

  &:hover {
    background: rgba(20, 20, 20, 0.06);
    color: #141414;
  }
`;

const StyledFormBody = styled.div`
  padding: 40px 32px 32px;
`;

const StyledTitle = styled.h2`
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
  color: #141414;
  text-align: center;
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
`;

const StyledLabel = styled.label`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #818181;
`;

const StyledInput = styled.input`
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid rgba(20, 20, 20, 0.14);
  border-radius: 8px;
  font-size: 15px;
  color: #141414;
  box-sizing: border-box;

  &:focus {
    outline: 2px solid rgba(37, 99, 235, 0.35);
    border-color: rgba(37, 99, 235, 0.55);
  }
`;

const StyledError = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  color: #b42318;
`;

const StyledSubmit = styled.button`
  width: 100%;
  height: 48px;
  margin-top: 8px;
  border: none;
  border-radius: 999px;
  background: #141414;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #2a2a2a;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledLegal = styled.p`
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #818181;
  text-align: center;
`;

const StyledLegalLink = styled(Link)`
  color: #474747;
  text-decoration: underline;
  text-underline-offset: 2px;
`;

const StyledBookingLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  min-height: 520px;

  @media (min-width: 900px) {
    grid-template-columns: 0.95fr 1.05fr;
  }
`;

const StyledSidebar = styled.div`
  padding: 40px 32px 32px;
  background: #fafafa;
  border-right: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledSidebarTitle = styled.h2`
  margin: 0 0 12px;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 600;
  line-height: 1.15;
  color: #141414;
`;

const StyledSidebarCopy = styled.p`
  margin: 0 0 24px;
  font-size: 16px;
  line-height: 1.55;
  color: #474747;
`;

const StyledSidebarEmailLink = styled.a`
  color: #141414;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
`;

const StyledCalendlyPanel = styled.div`
  padding: 24px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const StyledHiddenCalendlyPreload = styled.div`
  position: fixed;
  left: -9999px;
  top: 0;
  width: 400px;
  height: 620px;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
`;

const StyledLoading = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 360px;
  color: #474747;
  font-size: 15px;
`;

const StyledSpinner = styled.div`
  width: 36px;
  height: 36px;
  border: 3px solid rgba(20, 20, 20, 0.1);
  border-top-color: #141414;
  border-radius: 50%;
  animation: free-trial-spin 0.8s linear infinite;

  @keyframes free-trial-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledSuccessBody = styled.div`
  padding: 56px 32px 48px;
  text-align: center;
`;

const StyledSuccessTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 600;
  color: #141414;
`;

const StyledSuccessCopy = styled.p`
  margin: 0 0 24px;
  font-size: 16px;
  line-height: 1.55;
  color: #474747;
`;

const StyledSuccessButton = styled.button`
  height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: 8px;
  background: #141414;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
`;

const trackFreeTrialEvent = (
  eventName: string,
  props: Record<string, unknown>,
) => {
  trackWebsiteEvent(eventName, props);
  trackGA4Event(eventName, props);
};

const isCalendlyScheduledMessage = (
  data: unknown,
): data is {
  event: 'calendly.event_scheduled';
  payload: {
    event?: { uri?: string };
    invitee?: { uri?: string };
  };
} => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const record = data as Record<string, unknown>;

  return record.event === 'calendly.event_scheduled';
};

export const FreeTrialModal = ({
  isOpen,
  source,
  orgChartContext,
  intro,
  onClose,
}: FreeTrialModalProps) => {
  const [step, setStep] = useState<FreeTrialModalStep>(() =>
    getInitialStep(intro),
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lead, setLead] = useState<FreeTrialLeadPayload | null>(null);

  const resetModal = useCallback(() => {
    setStep(getInitialStep(intro));
    setName('');
    setEmail('');
    setCompany('');
    setError(null);
    setIsSubmitting(false);
    setLead(null);
  }, [intro]);

  const handleClose = useCallback(() => {
    resetModal();
    onClose();
  }, [onClose, resetModal]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    trackFreeTrialEvent('free_trial_modal_open', {
      source,
      orgChartCompany: orgChartContext?.companyName,
    });
  }, [isOpen, orgChartContext?.companyName, source]);

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen, resetModal]);

  useEffect(() => {
    if (isOpen) {
      setStep(getInitialStep(intro));
    }
  }, [intro, isOpen]);

  useEffect(() => {
    if (step !== 'calendly') {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (!isCalendlyScheduledMessage(event.data)) {
        return;
      }

      if (lead) {
        void submitCalendlyBookingCompleted({
          email: lead.email,
          name: lead.name,
          company: lead.company,
          calendlyEventUri: event.data.payload.event?.uri,
          calendlyInviteeUri: event.data.payload.invitee?.uri,
          calendlyPayload: event.data.payload,
        }).catch((error: unknown) => {
          console.error('Failed to submit Calendly booking to server', error);
        });
      }

      trackFreeTrialEvent('free_trial_calendly_scheduled', {
        source,
        orgChartCompany: orgChartContext?.companyName,
      });
      trackFreeTrialEvent('free_trial_complete', {
        source,
        orgChartCompany: orgChartContext?.companyName,
      });
      setStep('success');
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [lead, orgChartContext?.companyName, source, step]);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleClose();
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [handleClose, step]);

  const isFormComplete =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    company.trim().length > 0;

  const preloadCalendlyUrl = useMemo(() => {
    if (lead) {
      return buildFreeTrialCalendlyUrl({
        name: lead.name,
        email: lead.email,
        company: lead.company,
        source: lead.source,
        orgChartContext: lead.orgChartContext,
      });
    }

    if (isFormComplete) {
      return buildFreeTrialCalendlyUrl({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        company: company.trim(),
        source,
        orgChartContext,
      });
    }

    return buildFreeTrialCalendlyUrl({
      name: '',
      email: '',
      company: '',
      source,
      orgChartContext,
    });
  }, [company, email, isFormComplete, lead, name, orgChartContext, source]);

  const calendlyUrl = lead ? preloadCalendlyUrl : '';

  const shouldPreloadCalendly =
    step === 'intro' || step === 'form' || step === 'loading';

  const handleIntroCtaClick = useCallback(() => {
    trackFreeTrialEvent('free_trial_cta_click', {
      source,
      orgChartCompany: orgChartContext?.companyName,
    });
    setStep('form');
  }, [orgChartContext?.companyName, source]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCompany = company.trim();

    if (!trimmedName || !trimmedEmail || !trimmedCompany) {
      setError('Please fill in all required fields.');

      return;
    }

    if (!isAllowedEmailForNewWorkspaceSignup(trimmedEmail)) {
      setError(WORK_EMAIL_REQUIRED_MESSAGE);

      return;
    }

    setIsSubmitting(true);
    setStep('loading');

    const payload: FreeTrialLeadPayload = {
      name: trimmedName,
      email: trimmedEmail,
      company: trimmedCompany,
      source,
      orgChartContext,
    };

    try {
      const response = await fetch('/api/free-trial-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'Submission failed.');
      }

      setLead(payload);
      trackFreeTrialEvent('free_trial_form_submit', {
        source,
        orgChartCompany: orgChartContext?.companyName,
      });
      setStep('calendly');
      trackFreeTrialEvent('free_trial_calendly_view', {
        source,
        orgChartCompany: orgChartContext?.companyName,
      });
    } catch (submitError) {
      setStep('form');
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const hiddenCalendlyPreload =
    shouldPreloadCalendly && preloadCalendlyUrl ? (
      <StyledHiddenCalendlyPreload aria-hidden>
        <CalendlyInline url={preloadCalendlyUrl} />
      </StyledHiddenCalendlyPreload>
    ) : null;

  if (step === 'success') {
    return (
      <StyledBackdrop onClick={handleClose} role="presentation">
        <StyledFormDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-trial-success-title"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
          }}
        >
          <StyledSuccessBody>
            <StyledSuccessTitle id="free-trial-success-title">
              You&apos;re all set!
            </StyledSuccessTitle>
            <StyledSuccessCopy>
              Looking forward to meeting you. We&apos;ll see you on the call.
            </StyledSuccessCopy>
            <StyledSuccessButton type="button" onClick={handleClose}>
              Close
            </StyledSuccessButton>
          </StyledSuccessBody>
        </StyledFormDialog>
      </StyledBackdrop>
    );
  }

  const modalContent =
    step === 'intro' && intro ? (
      <StyledBackdrop onClick={handleClose} role="presentation">
        <StyledFormDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="orgchart-signup-modal-title"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
          }}
        >
          <StyledCloseButton
            type="button"
            onClick={handleClose}
            aria-label="Close"
          >
            <IconX size={20} stroke={1.75} />
          </StyledCloseButton>
          <OrgChartSignUpIntro
            node={intro.node}
            titleId="orgchart-signup-modal-title"
            companyName={intro.companyName}
            selectedCountry={intro.selectedCountry}
            selectedFunctionRoot={intro.selectedFunctionRoot}
            ctaLabel={FREE_TRIAL_CTA_LABEL}
            onCtaClick={handleIntroCtaClick}
            onDismiss={handleClose}
            showDismiss={false}
          />
        </StyledFormDialog>
      </StyledBackdrop>
    ) : step === 'form' || step === 'loading' ? (
      <StyledBackdrop onClick={handleClose} role="presentation">
        <StyledFormDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-trial-form-title"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
          }}
        >
          <StyledCloseButton
            type="button"
            onClick={handleClose}
            aria-label="Close"
          >
            <IconX size={20} stroke={1.75} />
          </StyledCloseButton>
          {step === 'loading' ? (
            <StyledLoading>
              <StyledSpinner aria-hidden />
              <span>Loading scheduling…</span>
            </StyledLoading>
          ) : (
            <StyledFormBody>
              <StyledTitle id="free-trial-form-title">
                Get free trial
              </StyledTitle>
              <form onSubmit={handleSubmit}>
                <StyledField>
                  <StyledLabel htmlFor="free-trial-name">
                    Full name *
                  </StyledLabel>
                  <StyledInput
                    id="free-trial-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Full name"
                    value={name}
                    onChange={(changeEvent) => {
                      setName(changeEvent.target.value);
                    }}
                    required
                  />
                </StyledField>
                <StyledField>
                  <StyledLabel htmlFor="free-trial-email">
                    Business email *
                  </StyledLabel>
                  <StyledInput
                    id="free-trial-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="mail@company.com"
                    value={email}
                    onChange={(changeEvent) => {
                      setEmail(changeEvent.target.value);
                    }}
                    required
                  />
                </StyledField>
                <StyledField>
                  <StyledLabel htmlFor="free-trial-company">
                    Company name *
                  </StyledLabel>
                  <StyledInput
                    id="free-trial-company"
                    name="company"
                    autoComplete="organization"
                    placeholder="Company name"
                    value={company}
                    onChange={(changeEvent) => {
                      setCompany(changeEvent.target.value);
                    }}
                    required
                  />
                </StyledField>
                {error && <StyledError>{error}</StyledError>}
                <StyledSubmit type="submit" disabled={isSubmitting}>
                  Submit
                </StyledSubmit>
                <StyledLegal>
                  By submitting this form, you agree to Arxena&apos;s{' '}
                  <StyledLegalLink href="/legal/privacy" target="_blank">
                    Privacy Policy
                  </StyledLegalLink>{' '}
                  and{' '}
                  <StyledLegalLink href="/legal/terms" target="_blank">
                    Terms of Use
                  </StyledLegalLink>
                  . You may unsubscribe at any time.
                </StyledLegal>
              </form>
            </StyledFormBody>
          )}
        </StyledFormDialog>
      </StyledBackdrop>
    ) : (
      <StyledBackdrop onClick={handleClose} role="presentation">
        <StyledDialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-trial-booking-title"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
          }}
        >
          <StyledCloseButton
            type="button"
            onClick={handleClose}
            aria-label="Close"
          >
            <IconX size={20} stroke={1.75} />
          </StyledCloseButton>
          <StyledBookingLayout>
            <StyledSidebar>
              <StyledSidebarTitle id="free-trial-booking-title">
                You&apos;re almost done!
              </StyledSidebarTitle>
              <StyledSidebarCopy>
                Pick a time to talk to one of our org intelligence specialists
                at{' '}
                <StyledSidebarEmailLink href="mailto:info@arxena.com">
                  info@arxena.com
                </StyledSidebarEmailLink>
                .
              </StyledSidebarCopy>
            </StyledSidebar>
            <StyledCalendlyPanel>
              {calendlyUrl ? (
                <CalendlyInline url={calendlyUrl} />
              ) : (
                <StyledLoading>
                  <StyledSpinner aria-hidden />
                </StyledLoading>
              )}
            </StyledCalendlyPanel>
          </StyledBookingLayout>
        </StyledDialog>
      </StyledBackdrop>
    );

  return (
    <>
      {hiddenCalendlyPreload}
      {modalContent}
    </>
  );
};
