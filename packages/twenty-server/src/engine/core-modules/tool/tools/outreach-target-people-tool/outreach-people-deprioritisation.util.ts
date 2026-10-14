import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';

export const DEPRIORITISED_FIELD = 'deprioritised';
export const DEPRIORITISED_REASONS_FIELD = 'deprioritisedReasons';

export type DeprioritisationReason = 'likely_fake_profile' | 'query_mismatch';

export const isDeprioritisedPerson = (
  person: OutreachEphemeralPerson,
): boolean => person.otherFields?.[DEPRIORITISED_FIELD] === true;

export const buildDeprioritisationFields = (
  reasons: DeprioritisationReason[],
): Record<string, unknown> =>
  reasons.length === 0
    ? {}
    : {
        otherFields: {
          [DEPRIORITISED_FIELD]: true,
          [DEPRIORITISED_REASONS_FIELD]: reasons,
        },
      };
