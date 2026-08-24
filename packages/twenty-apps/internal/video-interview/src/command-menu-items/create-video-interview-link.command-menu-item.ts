import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { CREATE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/create-video-interview-links-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: '983789e4-bf17-510f-a72a-686644fe0fca',
  label: 'Create Video Interview Link',
  shortLabel: 'Create VINT Link',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    CREATE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
