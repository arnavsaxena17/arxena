import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { SHARE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/share-video-interview-links-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: 'c446a9e6-d8a2-5838-9f51-b3000e4d73c2',
  label: 'Share Video Interview Link',
  shortLabel: 'Share VINT Link',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    SHARE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
