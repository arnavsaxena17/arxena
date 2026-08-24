import { isNonEmptyString } from '@sniptt/guards';

import { type GtmIcpSpec } from '@/gtm-home/types/gtm-home.types';

export type GtmIcpProfileSource = {
  icpSpec?: string | null;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const parseGtmIcpSpec = (
  icpSpec: string | null | undefined,
): GtmIcpSpec | null => {
  if (!isNonEmptyString(icpSpec)) {
    return null;
  }

  try {
    return normalizeGtmIcpSpec(JSON.parse(icpSpec));
  } catch {
    return null;
  }
};

export const normalizeGtmIcpSpec = (value: unknown): GtmIcpSpec => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { buyerTitles: [], locations: [] };
  }

  const record = value as Record<string, unknown>;
  const locations = [
    ...toStringList(record.locations),
    ...toStringList(record.geos),
  ];

  return {
    buyerTitles: toStringList(record.buyerTitles),
    locations: [...new Set(locations)],
  };
};

export const stringifyGtmIcpSpec = (spec: GtmIcpSpec): string =>
  JSON.stringify(normalizeGtmIcpSpec(spec));

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
  project: GtmIcpProfileSource | null | undefined;
  workspaceProfile: GtmIcpProfileSource | null | undefined;
}): {
  icpSpec: string | null;
  parsedIcp: GtmIcpSpec | null;
  isIcpRunOverride: boolean;
} => {
  const icpSpecResolution = resolveInheritedTextField(
    project?.icpSpec,
    workspaceProfile?.icpSpec,
  );
  const parsedIcp = parseGtmIcpSpec(icpSpecResolution.value);
  const normalizedIcpSpec = parsedIcp
    ? stringifyGtmIcpSpec(parsedIcp)
    : icpSpecResolution.value;

  return {
    icpSpec: normalizedIcpSpec,
    parsedIcp,
    isIcpRunOverride: icpSpecResolution.isRunOverride,
  };
};
