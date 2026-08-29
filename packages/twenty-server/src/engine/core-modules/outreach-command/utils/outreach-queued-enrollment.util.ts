import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';

export const isOutreachSourcingEnrollment = (
  origin: string,
  jobObject: { icpSpec?: string | null; name?: string | null },
): boolean =>
  origin.includes('outreach') ||
  origin.includes('gtm') ||
  Boolean(jobObject.icpSpec) ||
  /outreach|gtm/i.test(jobObject.name ?? '');

export const buildOutreachQueuedCreateFields = (profile: {
  linkedinUrl?: string;
  profileUrl?: string;
  linkedinProfileId?: string;
  experimentVariant?: 'A' | 'B' | null;
}): {
  outreachSequenceStage: 'QUEUED';
  linkedinProfileId?: string;
  experimentVariant?: 'A' | 'B';
} => {
  const linkedinProfileId =
    extractLinkedinProfileId(
      profile.linkedinUrl || profile.profileUrl || '',
    ) ||
    profile.linkedinProfileId ||
    '';

  return {
    outreachSequenceStage: 'QUEUED',
    ...(linkedinProfileId ? { linkedinProfileId } : {}),
    ...(profile.experimentVariant
      ? { experimentVariant: profile.experimentVariant }
      : {}),
  };
};
