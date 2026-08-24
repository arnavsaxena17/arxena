import { defineRole } from 'twenty-sdk/define';
import { getRoleUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';

export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = getRoleUniversalIdentifier({
  applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  label: 'Assistant default role',
});

export default defineRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Assistant default role',
  description: 'Default role for the Assistant application',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
});
