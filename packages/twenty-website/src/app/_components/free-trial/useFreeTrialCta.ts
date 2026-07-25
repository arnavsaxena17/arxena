'use client';

import { useCallback } from 'react';

import { trackGA4Event } from '@/lib/analytics';
import { FREE_TRIAL_CTA_LABEL } from '@/lib/free-trial-flow';
import {
  FreeTrialOrgChartContext,
  FreeTrialSource,
} from '@/lib/free-trial-types';
import { trackWebsiteEvent } from '@/lib/mixpanel';

import { useFreeTrialFlow } from './FreeTrialFlowProvider';

type UseFreeTrialCtaParams = {
  source: FreeTrialSource;
  orgChartContext?: FreeTrialOrgChartContext;
  legacyMixpanelEvent?: string;
  legacyGa4Event?: string;
  legacyGa4Props?: Record<string, string>;
};

export const useFreeTrialCta = ({
  source,
  orgChartContext,
  legacyMixpanelEvent = 'sign_up_click',
  legacyGa4Event = 'sign_up_click',
  legacyGa4Props,
}: UseFreeTrialCtaParams) => {
  const { isFreeTrialFlow, openFreeTrial } = useFreeTrialFlow();

  const handleClick = useCallback(
    (event?: { preventDefault: () => void }) => {
      if (!isFreeTrialFlow) {
        return;
      }

      event?.preventDefault();

      trackWebsiteEvent('free_trial_cta_click', {
        source,
        orgChartCompany: orgChartContext?.companyName,
      });
      trackGA4Event('free_trial_cta_click', {
        source,
        orgChartCompany: orgChartContext?.companyName,
      });
      openFreeTrial({ source, orgChartContext });
    },
    [isFreeTrialFlow, openFreeTrial, orgChartContext, source],
  );

  const handleLegacyClick = useCallback(() => {
    trackWebsiteEvent(legacyMixpanelEvent, {
      source,
      ...legacyGa4Props,
    });
    trackGA4Event(legacyGa4Event, {
      source,
      ...legacyGa4Props,
    });
  }, [legacyGa4Event, legacyGa4Props, legacyMixpanelEvent, source]);

  const onCtaClick = useCallback(
    (event?: { preventDefault: () => void }) => {
      if (isFreeTrialFlow) {
        handleClick(event);

        return;
      }

      handleLegacyClick();
    },
    [handleClick, handleLegacyClick, isFreeTrialFlow],
  );

  return {
    isFreeTrialFlow,
    ctaLabel: isFreeTrialFlow ? FREE_TRIAL_CTA_LABEL : undefined,
    onCtaClick,
  };
};
