import arvindPathak from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/arvind-pathak.json';
import deepakKorpal from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/deepak-korpal.json';
import divyeshShah from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/divyesh-shah.json';
import rajeevSonthalia from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/rajeev-sonthalia.json';
import sarbvirSingh from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/sarbvir-singh.json';
import saurabhSingh from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/saurabh-singh.json';
import vineetSharma from 'src/engine/core-modules/outreach-command/utils/mock-unipile-profiles/vineet-sharma.json';
import { isValidLinkedInProviderId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-attendee-id.util';
import { mapUnipileLinkedinProfile } from 'src/engine/core-modules/outreach-command/utils/map-unipile-linkedin-profile.util';
import {
  toUploadProfilesPerson,
  type UploadProfilesPerson,
} from 'src/engine/core-modules/outreach-command/utils/normalize-upload-people.util';

// Raw Unipile /linkedin/profile payloads used for outreach mock paths.
export const OUTREACH_MOCK_UNIPILE_RAW_PROFILES: Record<string, unknown>[] = [
  arvindPathak,
  deepakKorpal,
  divyeshShah,
  rajeevSonthalia,
  saurabhSingh,
  sarbvirSingh,
  vineetSharma,
] as Record<string, unknown>[];

const readPublicIdentifier = (profile: Record<string, unknown>): string => {
  const value = profile.public_identifier;

  return typeof value === 'string' ? value.trim() : '';
};

const readProviderId = (profile: Record<string, unknown>): string => {
  const value = profile.provider_id;

  return typeof value === 'string' ? value.trim() : '';
};

export const findOutreachMockUnipileRawProfile = (
  identifier: string,
): Record<string, unknown> | undefined => {
  const normalized = identifier.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  return OUTREACH_MOCK_UNIPILE_RAW_PROFILES.find((profile) => {
    const publicIdentifier = readPublicIdentifier(profile).toLowerCase();
    const providerId = readProviderId(profile);

    return (
      publicIdentifier === normalized ||
      providerId === identifier.trim() ||
      (isValidLinkedInProviderId(providerId) &&
        providerId.toLowerCase() === normalized)
    );
  });
};

export const mapOutreachMockUnipileProfile = (
  rawProfile: Record<string, unknown>,
) => {
  const publicIdentifier = readPublicIdentifier(rawProfile);

  return mapUnipileLinkedinProfile(rawProfile, publicIdentifier);
};

// mapUnipileLinkedinProfile → toUploadProfilesPerson (upload-profiles shape).
export const toOutreachMockUnipileUploadPerson = (
  rawProfile: Record<string, unknown>,
  projectId?: string,
): UploadProfilesPerson | null => {
  const mapped = mapOutreachMockUnipileProfile(rawProfile);
  const person = toUploadProfilesPerson({
    ...mapped,
    // Keep experience as current_positions so upload retains role history detail.
    current_positions: mapped.experience,
  });

  if (!person) {
    return null;
  }

  return {
    ...person,
    ...(projectId ? { projectId } : {}),
  };
};

export const buildOutreachMockUnipileUploadPeople = ({
  projectId,
}: {
  projectId: string;
}): UploadProfilesPerson[] =>
  OUTREACH_MOCK_UNIPILE_RAW_PROFILES.map((rawProfile) =>
    toOutreachMockUnipileUploadPerson(rawProfile, projectId),
  ).filter((person): person is UploadProfilesPerson => person !== null);
