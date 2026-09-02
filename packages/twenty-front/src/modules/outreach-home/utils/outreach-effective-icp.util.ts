import { isNonEmptyString } from '@sniptt/guards';
import { resolveOutreachConfigIcpSpecString } from 'twenty-shared/arx';

import { type IcpSpec } from '@/outreach-home/types/outreach-home.types';

export type IcpProfileSource = {
  icpSpec?: string | null;
  outreachConfig?: unknown;
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

export const parseIcpSpec = (
  icpSpec: string | null | undefined,
): IcpSpec | null => {
  if (!isNonEmptyString(icpSpec)) {
    return null;
  }

  try {
    return normalizeIcpSpec(JSON.parse(icpSpec));
  } catch {
    return null;
  }
};

export const normalizeIcpSpec = (value: unknown): IcpSpec => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { targetTitles: [], locations: [] };
  }

  const record = value as Record<string, unknown>;
  const locations = [
    ...toStringList(record.locations),
    ...toStringList(record.geos),
  ];

  return {
    targetTitles: readTargetTitles(record),
    locations: [...new Set(locations)],
  };
};

const readTargetTitles = (record: Record<string, unknown>): string[] => {
  const targetTitles = toStringList(record.targetTitles);

  if (targetTitles.length > 0) {
    return targetTitles;
  }

  return toStringList(record.buyerTitles);
};

export const stringifyIcpSpec = (spec: IcpSpec): string =>
  JSON.stringify(normalizeIcpSpec(spec));

export const resolveInheritedTextField = (
  projectValue: string | null | undefined,
  workspaceValue: string | null | undefined,
): { value: string | null; isProjectOverride: boolean } => {
  if (isNonEmptyString(projectValue)) {
    return { value: projectValue, isProjectOverride: true };
  }

  if (isNonEmptyString(workspaceValue)) {
    return { value: workspaceValue, isProjectOverride: false };
  }

  return { value: null, isProjectOverride: false };
};

export const resolveEffectiveIcp = ({
  project,
  workspaceProfile,
}: {
  project: IcpProfileSource | null | undefined;
  workspaceProfile: IcpProfileSource | null | undefined;
}): {
  icpSpec: string | null;
  parsedIcp: IcpSpec | null;
  isIcpProjectOverride: boolean;
} => {
  const projectIcpSpec = resolveOutreachConfigIcpSpecString(
    project?.outreachConfig,
    project?.icpSpec,
  );
  const icpSpecResolution = resolveInheritedTextField(
    projectIcpSpec,
    workspaceProfile?.icpSpec,
  );
  const parsedIcp = parseIcpSpec(icpSpecResolution.value);
  const normalizedIcpSpec = parsedIcp
    ? stringifyIcpSpec(parsedIcp)
    : icpSpecResolution.value;

  return {
    icpSpec: normalizedIcpSpec,
    parsedIcp,
    isIcpProjectOverride: icpSpecResolution.isProjectOverride,
  };
};
