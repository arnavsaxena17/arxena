import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { DOWNLOAD_CANDIDATE_CVS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/download-candidate-cvs-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: 'efedf4a4-5859-51ab-99de-e7ce0ada9aba',
  label: 'Download Candidate CVs',
  shortLabel: 'Download CVs',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    DOWNLOAD_CANDIDATE_CVS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
