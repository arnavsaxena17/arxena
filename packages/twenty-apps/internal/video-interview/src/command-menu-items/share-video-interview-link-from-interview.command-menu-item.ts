import { defineCommandMenuItem } from 'twenty-sdk/define';

import { VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { SHARE_VIDEO_INTERVIEW_LINKS_FROM_INTERVIEW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/share-video-interview-links-from-interview-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: '3b401259-9bab-5cfa-9651-d7839c9e02f5',
  label: 'Share Video Interview Link With Candidate',
  shortLabel: 'Share VINT Link with Candidate',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    SHARE_VIDEO_INTERVIEW_LINKS_FROM_INTERVIEW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "videoInterview" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
