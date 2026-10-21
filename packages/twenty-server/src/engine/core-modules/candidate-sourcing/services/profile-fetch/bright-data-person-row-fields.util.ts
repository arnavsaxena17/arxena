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
  const otherFields: Record<string, unknown> = {
    ...buildBrightDataPersonOtherFields(record),
    ...(isUsableProfile(profile) ? { [PROFILE_FIELD_KEY]: profile } : {}),
  };

  return {
    otherFields,
    ...(isUsableProfile(profile) ? { profile } : {}),
  };
};
