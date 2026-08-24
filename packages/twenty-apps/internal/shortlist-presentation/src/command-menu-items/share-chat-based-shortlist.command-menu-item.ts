import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { SHARE_CHAT_BASED_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/share-chat-based-shortlist-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: 'cbc17f0f-4957-56eb-99f4-17ea46ad4a80',
  label: 'Share Chat Based Shortlist',
  shortLabel: 'Share Chat Shortlist',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    SHARE_CHAT_BASED_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
