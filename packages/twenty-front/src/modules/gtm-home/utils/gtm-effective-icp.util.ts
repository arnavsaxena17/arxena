import { isNonEmptyString } from '@sniptt/guards';

import { type GtmIcpSet } from '@/gtm-home/types/gtm-home.types';

export type GtmIcpSpecParsed = {
  name?: string;
  industries?: string[];
  employeeRange?: string;
  geos?: string[];
  buyerTitles?: string[];
  painSignals?: string[];
  stdFunctions?: string[];
  stdGrades?: string[];
};

export type GtmProfileIcpSource = {
  icpSpec?: string | null;
  icpSegment?: string | null;
  icpBlurb?: string | null;
  companySearchBlurb?: string | null;
  peopleSearchBlurb?: string | null;
};

export const parseGtmIcpSpec = (
  icpSpec: string | null | undefined,
): GtmIcpSpecParsed | null => {
  if (!isNonEmptyString(icpSpec)) {
    return null;
  }

  try {
    return JSON.parse(icpSpec) as GtmIcpSpecParsed;
  } catch {
    return null;
  }
};

export const resolveInheritedTextField = (
  projectValue: string | null | undefined,
  workspaceValue: string | null | undefined,
): { value: string | null; isRunOverride: boolean } => {
  if (isNonEmptyString(projectValue)) {
    return { value: projectValue, isRunOverride: true };
  }

  if (isNonEmptyString(workspaceValue)) {
    return { value: workspaceValue, isRunOverride: false };
  }

  return { value: null, isRunOverride: false };
};

export const resolveEffectiveGtmIcp = ({
  project,
  workspaceProfile,
}: {
  project: GtmProfileIcpSource | null | undefined;
  workspaceProfile: GtmProfileIcpSource | null | undefined;
}): {
  icpSpec: string | null;
  icpSegment: string | null;
  parsedIcp: GtmIcpSpecParsed | null;
  icpBlurb: string | null;
  companySearchBlurb: string | null;
  peopleSearchBlurb: string | null;
  isIcpRunOverride: boolean;
  isIcpBlurbRunOverride: boolean;
  isCompanySearchBlurbRunOverride: boolean;
  isPeopleSearchBlurbRunOverride: boolean;
} => {
  const icpSpecResolution = resolveInheritedTextField(
    project?.icpSpec,
    workspaceProfile?.icpSpec,
  );
  const icpSegmentResolution = resolveInheritedTextField(
    project?.icpSegment,
    workspaceProfile?.icpSegment,
  );
  const icpBlurbResolution = resolveInheritedTextField(
    project?.icpBlurb,
    workspaceProfile?.icpBlurb,
  );
  const companySearchBlurbResolution = resolveInheritedTextField(
    project?.companySearchBlurb,
    workspaceProfile?.companySearchBlurb,
  );
  const peopleSearchBlurbResolution = resolveInheritedTextField(
    project?.peopleSearchBlurb,
    workspaceProfile?.peopleSearchBlurb,
  );

  return {
    icpSpec: icpSpecResolution.value,
    icpSegment: icpSegmentResolution.value,
    parsedIcp: parseGtmIcpSpec(icpSpecResolution.value),
    icpBlurb: icpBlurbResolution.value,
    companySearchBlurb: companySearchBlurbResolution.value,
    peopleSearchBlurb: peopleSearchBlurbResolution.value,
    isIcpRunOverride: icpSpecResolution.isRunOverride,
    isIcpBlurbRunOverride: icpBlurbResolution.isRunOverride,
    isCompanySearchBlurbRunOverride: companySearchBlurbResolution.isRunOverride,
    isPeopleSearchBlurbRunOverride: peopleSearchBlurbResolution.isRunOverride,
  };
};

export const toGtmIcpSet = (
  parsedIcp: GtmIcpSpecParsed | null,
  icpSegment: string | null,
): GtmIcpSet | null => {
  if (!parsedIcp && !isNonEmptyString(icpSegment)) {
    return null;
  }

  return {
    name: parsedIcp?.name ?? icpSegment ?? 'ICP',
    industries: parsedIcp?.industries ?? [],
    employeeRange: parsedIcp?.employeeRange ?? '',
    geos: parsedIcp?.geos ?? [],
    buyerTitles: parsedIcp?.buyerTitles ?? [],
    painSignals: parsedIcp?.painSignals ?? [],
    stdFunctions: parsedIcp?.stdFunctions ?? [],
    stdGrades: parsedIcp?.stdGrades ?? [],
  };
};
