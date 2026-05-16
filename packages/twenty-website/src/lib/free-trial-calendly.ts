import { buildCalendlyUrlWithPrefill } from 'twenty-shared';

import { FreeTrialOrgChartContext, FreeTrialSource } from './free-trial-types';

const DEFAULT_CALENDLY_URL = 'https://calendly.com/arxena/30min';

const getCalendlyBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim();

  return url && url.length > 0 ? url : DEFAULT_CALENDLY_URL;
};

const buildOrgChartContextLine = (
  context?: FreeTrialOrgChartContext,
): string | undefined => {
  if (!context) {
    return undefined;
  }

  const parts: string[] = [];

  if (context.companyName?.trim()) {
    parts.push(`Org chart: ${context.companyName.trim()}`);
  }
  if (
    context.selectedFunctionRoot &&
    context.selectedFunctionRoot !== 'fullcompany'
  ) {
    parts.push(`Function: ${context.selectedFunctionRoot}`);
  }
  if (context.selectedCountry && context.selectedCountry !== 'global') {
    parts.push(`Country: ${context.selectedCountry}`);
  }
  if (context.nodeHeadline?.trim()) {
    parts.push(`Role: ${context.nodeHeadline.trim()}`);
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
};

export const buildFreeTrialCalendlyUrl = (params: {
  name: string;
  email: string;
  company: string;
  source: FreeTrialSource;
  orgChartContext?: FreeTrialOrgChartContext;
}): string => {
  const customAnswers: Record<string, string> = {
    a1: params.company,
  };

  const orgContextLine = buildOrgChartContextLine(params.orgChartContext);

  if (orgContextLine) {
    customAnswers.a2 = orgContextLine;
  }

  return buildCalendlyUrlWithPrefill(getCalendlyBaseUrl(), {
    name: params.name,
    email: params.email,
    customAnswers,
    utm: {
      source: 'arxena_website',
      medium: 'free_trial',
      campaign: params.source,
      content: params.orgChartContext?.companyName,
    },
  });
};
