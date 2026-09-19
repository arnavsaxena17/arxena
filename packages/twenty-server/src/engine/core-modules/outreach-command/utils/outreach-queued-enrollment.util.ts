import {
  applyOutreachAnalyticsEvent,
  type OutreachAnalytics,
} from 'twenty-shared';

import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';

export type OutreachEnrollmentStage =
  | 'QUEUED'
  | 'CONNECTION_SENT'
  | 'CONNECTION_ACCEPTED';

export type LinkedinEnrollmentSignals = {
  linkedinUrl?: string;
  profileUrl?: string;
  linkedinProfileId?: string;
  experimentVariant?: 'A' | 'B' | null;
  pendingInvitation?: boolean;
  pending_invitation?: boolean;
  networkDistance?: string;
  network_distance?: string;
  lastOutreachActivity?: {
    type?: string;
    performed_at?: string;
  } | null;
  last_outreach_activity?: {
    type?: string;
    performed_at?: string;
  } | null;
  linkedinSpecificData?: {
    networkDistance?: string;
    pendingInvitation?: boolean;
    lastOutreachActivity?: {
      type?: string;
      performed_at?: string;
    } | null;
  };
};

export const isOutreachSourcingEnrollment = (
  origin: string,
  jobObject: { icpSpec?: string | null; name?: string | null },
): boolean =>
  origin.includes('outreach') ||
  origin.includes('gtm') ||
  Boolean(jobObject.icpSpec) ||
  /outreach|gtm/i.test(jobObject.name ?? '');

const readPendingInvitation = (profile: LinkedinEnrollmentSignals): boolean =>
  profile.pendingInvitation === true ||
  profile.pending_invitation === true ||
  profile.linkedinSpecificData?.pendingInvitation === true;

const readNetworkDistance = (profile: LinkedinEnrollmentSignals): string =>
  (
    profile.networkDistance ||
    profile.network_distance ||
    profile.linkedinSpecificData?.networkDistance ||
    ''
  ).trim();

const readLastOutreachActivity = (
  profile: LinkedinEnrollmentSignals,
): { type?: string; performed_at?: string } | null => {
  const activity =
    profile.lastOutreachActivity ??
    profile.last_outreach_activity ??
    profile.linkedinSpecificData?.lastOutreachActivity ??
    null;

  if (!activity || typeof activity !== 'object') {
    return null;
  }

  return activity;
};

const readActivityTimestamp = (
  activity: { performed_at?: string } | null,
  fallbackIso: string,
): string => {
  const performedAt = activity?.performed_at?.trim();

  if (!performedAt) {
    return fallbackIso;
  }

  return Number.isFinite(Date.parse(performedAt)) ? performedAt : fallbackIso;
};

// LinkedIn search: pending invite → CONNECTION_SENT; 1st-degree / ACCEPT_INVITATION → CONNECTION_ACCEPTED
export const inferOutreachEnrollmentStageFromLinkedin = (
  profile: LinkedinEnrollmentSignals,
): OutreachEnrollmentStage => {
  if (readPendingInvitation(profile)) {
    return 'CONNECTION_SENT';
  }

  const lastOutreachActivity = readLastOutreachActivity(profile);
  const networkDistance = readNetworkDistance(profile);

  if (
    lastOutreachActivity?.type === 'ACCEPT_INVITATION' ||
    networkDistance === 'DISTANCE_1' ||
    networkDistance === 'SELF'
  ) {
    return 'CONNECTION_ACCEPTED';
  }

  return 'QUEUED';
};

const buildEnrollmentOutreachAnalytics = ({
  stage,
  profile,
  nowIso,
}: {
  stage: OutreachEnrollmentStage;
  profile: LinkedinEnrollmentSignals;
  nowIso: string;
}): OutreachAnalytics | undefined => {
  if (stage === 'QUEUED') {
    return undefined;
  }

  const lastOutreachActivity = readLastOutreachActivity(profile);
  const eventIso = readActivityTimestamp(lastOutreachActivity, nowIso);

  if (stage === 'CONNECTION_SENT') {
    return applyOutreachAnalyticsEvent({
      existing: null,
      event: 'connection_sent',
      nowIso: eventIso,
      enrolledAt: nowIso,
    });
  }

  return applyOutreachAnalyticsEvent({
    existing: applyOutreachAnalyticsEvent({
      existing: null,
      event: 'connection_sent',
      nowIso: eventIso,
      enrolledAt: nowIso,
    }),
    event: 'connection_accepted',
    nowIso: eventIso,
    enrolledAt: nowIso,
  });
};

export const buildOutreachQueuedCreateFields = (
  profile: LinkedinEnrollmentSignals,
  options?: { nowIso?: string },
): {
  outreachSequenceStage: OutreachEnrollmentStage;
  linkedinProfileId?: string;
  experimentVariant?: 'A' | 'B';
  outreachAnalytics?: OutreachAnalytics;
} => {
  const linkedinProfileId =
    extractLinkedinProfileId(profile.linkedinUrl || profile.profileUrl || '') ||
    profile.linkedinProfileId ||
    '';
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const outreachSequenceStage =
    inferOutreachEnrollmentStageFromLinkedin(profile);
  const outreachAnalytics = buildEnrollmentOutreachAnalytics({
    stage: outreachSequenceStage,
    profile,
    nowIso,
  });

  // startOutreach / stopOutreach default false via candidateFlags defaults —
  // enroll must not flip startOutreach or the sequencer will flood on upload.
  return {
    outreachSequenceStage,
    ...(linkedinProfileId ? { linkedinProfileId } : {}),
    ...(profile.experimentVariant
      ? { experimentVariant: profile.experimentVariant }
      : {}),
    ...(outreachAnalytics ? { outreachAnalytics } : {}),
  };
};
