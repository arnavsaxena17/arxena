import { isNonEmptyString } from '@sniptt/guards';

import { type GtmIcpSet } from '@/gtm-home/types/gtm-home.types';

export type GtmIcpSpecParsed = {
  // Legacy embed when icpBlurb column was missing; prefer dedicated field
  blurb?: string;
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

export const extractIcpBlurbFromSpec = (
  icpSpec: string | null | undefined,
): string | null => {
  const parsedIcp = parseGtmIcpSpec(icpSpec);

  if (!isNonEmptyString(parsedIcp?.blurb)) {
    return null;
  }

  return parsedIcp.blurb;
};

// Structured filters only — NL definition belongs in icpBlurb
export const stripBlurbFromIcpSpec = (
  icpSpec: string | null | undefined,
): string | null => {
  if (!isNonEmptyString(icpSpec)) {
    return null;
  }

  try {
    const parsedIcp = JSON.parse(icpSpec) as Record<string, unknown>;

    if (!('blurb' in parsedIcp)) {
      return icpSpec;
    }

    const { blurb: _blurb, ...structuredIcp } = parsedIcp;

    return JSON.stringify(structuredIcp);
  } catch {
    return icpSpec;
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

  const parsedIcp = parseGtmIcpSpec(icpSpecResolution.value);
  const embeddedIcpBlurb = extractIcpBlurbFromSpec(icpSpecResolution.value);
  const normalizedIcpSpec = stripBlurbFromIcpSpec(icpSpecResolution.value);

  return {
    icpSpec: normalizedIcpSpec,
    icpSegment: icpSegmentResolution.value,
    parsedIcp: parseGtmIcpSpec(normalizedIcpSpec) ?? parsedIcp,
    // Prefer dedicated column; fall back to legacy blurb key inside icpSpec JSON
    icpBlurb: icpBlurbResolution.value ?? embeddedIcpBlurb,
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
