import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { CREATE_SHORTLIST_DOCUMENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/create-shortlist-document-effect.front-component';

export default defineCommandMenuItem({
  universalIdentifier: 'ae0914ec-dbdd-55e2-b0ff-4def73dcd4b1',
  label: 'Create Shortlist PDF and Excel',
  shortLabel: 'Create Shortlist Docs',
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    CREATE_SHORTLIST_DOCUMENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression:
    'numberOfSelectedRecords >= 1 and objectMetadataItem.nameSingular == "candidate" and (isSelectAll or noneDefined(selectedRecords, "deletedAt"))',
});
