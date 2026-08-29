import { createHash } from 'crypto';

export type OutreachExperimentVariant = 'A' | 'B';

export type OutreachExperimentWorkflowBinding = {
  workflowId: string;
  versionA?: string;
  versionB?: string;
};

export type OutreachExperimentConfig = {
  status: 'running' | 'paused' | 'completed';
  split: number;
  name?: string;
  workflows?: {
    companySearch?: OutreachExperimentWorkflowBinding;
    perCandidate?: OutreachExperimentWorkflowBinding;
    candidateUpdated?: OutreachExperimentWorkflowBinding;
  };
};

export const parseOutreachExperimentConfig = (
  raw: string | null | undefined,
): OutreachExperimentConfig | null => {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as OutreachExperimentConfig;

    if (
      parsed.status !== 'running' &&
      parsed.status !== 'paused' &&
      parsed.status !== 'completed'
    ) {
      return null;
    }

    const split =
      typeof parsed.split === 'number' && Number.isFinite(parsed.split)
        ? Math.min(1, Math.max(0, parsed.split))
        : 0.5;

    return {
      ...parsed,
      split,
    };
  } catch {
    return null;
  }
};

export const stringifyOutreachExperimentConfig = (
  config: OutreachExperimentConfig,
): string => JSON.stringify(config);

/**
 * Deterministic A/B assignment. Same profile id always lands in the same bucket
 * for a given split (default 50/50).
 */
export const assignOutreachExperimentVariant = ({
  seed,
  split = 0.5,
}: {
  seed: string;
  split?: number;
}): OutreachExperimentVariant => {
  const normalizedSeed = seed.trim().toLowerCase();
  const hash = createHash('sha256').update(normalizedSeed).digest();
  const bucket = hash.readUInt32BE(0) / 0xffffffff;

  return bucket < split ? 'A' : 'B';
};

export const CAPACITY_PENDING_REASONS = new Set([
  'outreach_send_window',
  'outreach_unipile_pacing',
  'linkedin_rate_limit',
  'outreach_project_paused',
]);

export const SEQUENCE_DELAY_PENDING_REASON = 'outreach_sequence_delay';

export type OutreachOutboundMessageKind =
  | 'CONNECT_NOTE'
  | 'OPENER'
  | 'FU1'
  | 'FU2'
  | 'FU3'
  | 'EMAIL';

export const resolveOutreachOutboundMessageKind = ({
  materializeEvent,
  messagingChannel,
  linkedinFollowUpCount,
  explicitKind,
}: {
  materializeEvent?: string | null;
  messagingChannel?: string | null;
  linkedinFollowUpCount?: number | null;
  explicitKind?: string | null;
}): OutreachOutboundMessageKind | null => {
  if (
    explicitKind === 'CONNECT_NOTE' ||
    explicitKind === 'OPENER' ||
    explicitKind === 'FU1' ||
    explicitKind === 'FU2' ||
    explicitKind === 'FU3' ||
    explicitKind === 'EMAIL'
  ) {
    return explicitKind;
  }

  if (materializeEvent === 'connection_sent') {
    return 'CONNECT_NOTE';
  }

  const channel = (messagingChannel ?? '').toUpperCase();

  if (channel.includes('EMAIL') || materializeEvent === 'enrich_found') {
    return 'EMAIL';
  }

  if (
    materializeEvent === 'outbound_message' ||
    channel.includes('LINKEDIN') ||
    channel.includes('INMAIL')
  ) {
    const count = linkedinFollowUpCount ?? 0;

    if (count <= 0) {
      return 'OPENER';
    }

    if (count === 1) {
      return 'FU1';
    }

    if (count === 2) {
      return 'FU2';
    }

    return 'FU3';
  }

  return null;
};
