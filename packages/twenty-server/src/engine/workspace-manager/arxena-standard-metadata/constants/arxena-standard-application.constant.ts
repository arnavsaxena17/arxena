import { ApplicationRegistrationSourceType } from 'src/engine/core-modules/application/application-registration/enums/application-registration-source-type.enum';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';

// Stable across workspaces — never change after shipping
export const ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER =
  'a8e8a8e8-64aa-4b6f-b003-9c74b97cee21';

export const ARXENA_STANDARD_APPLICATION_NAME = 'Arxena Standard';

export const ARXENA_STANDARD_APPLICATION = {
  universalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  name: ARXENA_STANDARD_APPLICATION_NAME,
  description: 'Arxena recruiting domain objects, fields, and relations',
  version: '1.0.0',
  sourcePath: 'arxena-standard',
  sourceType: ApplicationRegistrationSourceType.LOCAL,
} as const satisfies Pick<
  ApplicationEntity,
  | 'universalIdentifier'
  | 'name'
  | 'description'
  | 'version'
  | 'sourcePath'
  | 'sourceType'
>;

export const CANDIDATE_ENRICHMENT_OBJECT_NAME_SINGULAR =
  'candidateEnrichment' as const;

// Inverse relations onto Arxena Standard hosts for AI filtering.
export const CANDIDATE_ENRICHMENT_HOST_EXTENSION_FIELDS: Array<{
  objectName: string;
  fieldName: string;
}> = [
  { objectName: 'project', fieldName: 'candidateEnrichments' },
  { objectName: 'workspaceMember', fieldName: 'candidateEnrichment' },
];
