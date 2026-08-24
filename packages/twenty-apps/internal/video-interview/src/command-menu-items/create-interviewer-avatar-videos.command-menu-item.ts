import { defineCommandMenuItem } from 'twenty-sdk/define';

import { PROJECT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { CREATE_INTERVIEWER_AVATAR_VIDEOS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/create-interviewer-avatar-videos-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: 'bd6135ae-947b-5b9a-a835-6fcce631f22d',
  label: 'Create Interviewer Avatar Videos',
  shortLabel: 'Create Interviewer Avatar Videos',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    CREATE_INTERVIEWER_AVATAR_VIDEOS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "project" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
