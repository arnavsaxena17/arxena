import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

const workspaceMemberObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier;

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: workspaceMemberObjectUniversalIdentifier,
    name: 'candidateEnrichment',
  }),
  objectUniversalIdentifier: workspaceMemberObjectUniversalIdentifier,
  type: FieldType.RELATION,
  name: 'candidateEnrichment',
  label: 'candidateEnrichments',
  icon: 'IconEnrich',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier:
        CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'recruiter',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
