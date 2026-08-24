import { ApplicationRegistrationSourceType } from 'src/engine/core-modules/application/application-registration/enums/application-registration-source-type.enum';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';

export const ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER =
  'd5f94a1b-8c6e-4b29-a7d8-2e3f4a5b6c70';

export const ASSISTANT_APPLICATION_NAME = 'Assistant';

export const ASSISTANT_APPLICATION = {
  universalIdentifier: ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER,
  name: ASSISTANT_APPLICATION_NAME,
  description:
    'Assistant threads for Ask AI / candidate search sessions, including search parameters and autonomous recruiter mode',
  version: '0.1.0',
  sourcePath: 'assistant',
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

export const ASSISTANT_OBJECT_NAME_SINGULARS = ['assistantThread'] as const;

/** No command-menu items owned by this app yet (host leftovers use Nest/front). */
export const ASSISTANT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS = [] as const;

// Inverse relations onto shared Arxena Standard / Twenty hosts only.
// Nest assistant/, autonomous-recruiter/, and candidate-search thread adapters
// stay as host leftovers and write to these fields when the app is installed.
export const ASSISTANT_HOST_EXTENSION_FIELDS: Array<{
  objectName: string;
  fieldName: string;
}> = [
  { objectName: 'project', fieldName: 'assistantThreads' },
  { objectName: 'workspaceMember', fieldName: 'assistantThreads' },
];

export const isAssistantObjectName = (nameSingular: string): boolean =>
  (ASSISTANT_OBJECT_NAME_SINGULARS as readonly string[]).includes(nameSingular);

export const isAssistantHostExtensionField = ({
  objectName,
  fieldName,
}: {
  objectName: string;
  fieldName: string;
}): boolean =>
  ASSISTANT_HOST_EXTENSION_FIELDS.some(
    (field) =>
      field.objectName === objectName && field.fieldName === fieldName,
  );

export const isAssistantRelation = ({
  fromObjectName,
  toObjectName,
}: {
  fromObjectName: string;
  toObjectName: string;
}): boolean =>
  isAssistantObjectName(fromObjectName) ||
  isAssistantObjectName(toObjectName);
