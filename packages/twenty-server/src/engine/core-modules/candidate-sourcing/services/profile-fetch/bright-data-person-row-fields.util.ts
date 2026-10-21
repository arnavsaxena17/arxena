import { isDefined } from 'twenty-shared/utils';

import { buildBrightDataPersonOtherFields } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  PROFILE_FIELD_KEY,
  isUsableProfile,
  profileToRowProfile,
  type RowProfile,
} from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';

// One path for every Bright Data person record → People-tab otherFields.
// Used by find_role_at_companies (people search) and fetch_profiles (URL scrape).
export const brightDataRecordToPersonOtherFields = (
  record: Record<string, unknown>,
  options?: { fetchedAt?: string },
): { otherFields: Record<string, unknown>; profile?: RowProfile } => {
  const fetchedAt = options?.fetchedAt ?? new Date().toISOString();
  const profile = profileToRowProfile({
    source: 'bright_data',
    record,
    fetchedAt,
  });
  const baseFields = buildBrightDataPersonOtherFields(record);
  const otherFields: Record<string, unknown> = {
    ...baseFields,
    // The nested profile is one cell; experience as its own column keeps it
    // readable on the People tab when the record has no work-experience list
    ...(isDefined(profile.experience) && !isDefined(baseFields.workExperience)
      ? { experience: profile.experience }
      : {}),
    ...(isUsableProfile(profile) ? { [PROFILE_FIELD_KEY]: profile } : {}),
  };

  return {
    otherFields,
    ...(isUsableProfile(profile) ? { profile } : {}),
  };
};
