import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { DOWNLOAD_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/download-shortlist-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: '2add3d88-c5f5-5397-854c-5f7f51d10143',
  label: 'Download Shortlist',
  shortLabel: 'Download Shortlist',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    DOWNLOAD_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
