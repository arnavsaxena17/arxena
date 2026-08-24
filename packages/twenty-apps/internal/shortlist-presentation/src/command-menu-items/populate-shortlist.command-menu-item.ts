import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { POPULATE_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/populate-shortlist-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: 'e8ffb95c-bef5-53c9-a92d-9edbb659cf4c',
  label: 'Populate Shortlist Records',
  shortLabel: 'Populate Shortlist',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    POPULATE_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
