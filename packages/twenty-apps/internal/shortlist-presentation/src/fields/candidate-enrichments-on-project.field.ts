import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'candidateEnrichments',
  }),
  objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'candidateEnrichments',
  label: 'CandidateEnrichments',
  icon: 'IconEnrich',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'project',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
