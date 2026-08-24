import { ApplicationRegistrationSourceType } from 'src/engine/core-modules/application/application-registration/enums/application-registration-source-type.enum';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';

export const SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER =
  'b7d82c3e-8e4a-4f19-a6c7-0d1e2f3a4b58';

export const SHORTLIST_PRESENTATION_APPLICATION_NAME = 'Shortlist Presentation';

export const SHORTLIST_PRESENTATION_APPLICATION = {
  universalIdentifier: SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER,
  name: SHORTLIST_PRESENTATION_APPLICATION_NAME,
  description:
    'Candidate shortlist presentation: shortlist rows, CV Sent batches, screening, AI filters, and phone calls',
  version: '0.1.0',
  sourcePath: 'shortlist-presentation',
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

export const SHORTLIST_PRESENTATION_OBJECT_NAME_SINGULARS = [
  'shortlist',
  'cvSent',
  'screening',
  'candidateEnrichment',
  'phoneCall',
] as const;

export const SHORTLIST_PRESENTATION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS = [
  'e8ffb95c-bef5-53c9-a92d-9edbb659cf4c',
  'cbc17f0f-4957-56eb-99f4-17ea46ad4a80',
  'ae0914ec-dbdd-55e2-b0ff-4def73dcd4b1',
  '2add3d88-c5f5-5397-854c-5f7f51d10143',
  'efedf4a4-5859-51ab-99de-e7ce0ada9aba',
] as const;

// Inverse relations onto shared Arxena Standard hosts only.
// Arx Chat / engagement / ATS scalars (startChat, stopChat, status,
 // chatQuestions, rate limits, JD fields, …) stay on Arxena Standard.
export const SHORTLIST_PRESENTATION_HOST_EXTENSION_FIELDS: Array<{
  objectName: string;
  fieldName: string;
}> = [
  { objectName: 'candidate', fieldName: 'shortlistObj' },
  { objectName: 'candidate', fieldName: 'shortlists' },
  { objectName: 'candidate', fieldName: 'cvSents' },
  { objectName: 'candidate', fieldName: 'screenings' },
  { objectName: 'project', fieldName: 'shortlists' },
  { objectName: 'project', fieldName: 'cvSents' },
  { objectName: 'project', fieldName: 'candidateEnrichments' },
  { objectName: 'person', fieldName: 'phoneCall' },
  { objectName: 'workspaceMember', fieldName: 'candidateEnrichment' },
];

export const isShortlistPresentationObjectName = (
  nameSingular: string,
): boolean =>
  (SHORTLIST_PRESENTATION_OBJECT_NAME_SINGULARS as readonly string[]).includes(
    nameSingular,
  );

export const isShortlistPresentationHostExtensionField = ({
  objectName,
  fieldName,
}: {
  objectName: string;
  fieldName: string;
}): boolean =>
  SHORTLIST_PRESENTATION_HOST_EXTENSION_FIELDS.some(
    (field) =>
      field.objectName === objectName && field.fieldName === fieldName,
  );

export const isShortlistPresentationRelation = ({
  fromObjectName,
  toObjectName,
}: {
  fromObjectName: string;
  toObjectName: string;
}): boolean =>
  isShortlistPresentationObjectName(fromObjectName) ||
  isShortlistPresentationObjectName(toObjectName);
