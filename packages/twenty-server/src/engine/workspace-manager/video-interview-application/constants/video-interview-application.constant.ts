import { ApplicationRegistrationSourceType } from 'src/engine/core-modules/application/application-registration/enums/application-registration-source-type.enum';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';

export const VIDEO_INTERVIEW_APPLICATION_UNIVERSAL_IDENTIFIER =
  'c4e91b2a-7d3f-4a18-b5e6-9f0c1d2e3a47';

export const VIDEO_INTERVIEW_APPLICATION_NAME = 'Video Interview';

export const VIDEO_INTERVIEW_APPLICATION = {
  universalIdentifier: VIDEO_INTERVIEW_APPLICATION_UNIVERSAL_IDENTIFIER,
  name: VIDEO_INTERVIEW_APPLICATION_NAME,
  description:
    'Async one-way video interviews: templates, questions, candidate interviews, and responses',
  version: '0.1.0',
  sourcePath: 'video-interview',
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

export const VIDEO_INTERVIEW_OBJECT_NAME_SINGULARS = [
  'videoInterviewModel',
  'videoInterviewTemplate',
  'videoInterviewQuestion',
  'videoInterview',
  'videoInterviewResponse',
] as const;

export const VIDEO_INTERVIEW_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS = [
  '983789e4-bf17-510f-a72a-686644fe0fca',
  'c446a9e6-d8a2-5838-9f51-b3000e4d73c2',
  '3b401259-9bab-5cfa-9651-d7839c9e02f5',
  'bd6135ae-947b-5b9a-a835-6fcce631f22d',
] as const;

export const VIDEO_INTERVIEW_HOST_EXTENSION_FIELDS: Array<{
  objectName: string;
  fieldName: string;
}> = [
  // Relation fields onto Arxena/Twenty hosts — only present while the app is installed.
  // Chat control booleans stay on Arxena Standard so invite flows work without the app.
  { objectName: 'candidate', fieldName: 'videoInterview' },
  { objectName: 'candidate', fieldName: 'videoInterviewResponse' },
  { objectName: 'project', fieldName: 'videoInterviewTemplate' },
  { objectName: 'project', fieldName: 'videoInterviewResponse' },
  { objectName: 'person', fieldName: 'videoInterviewResponse' },
];

export const isVideoInterviewObjectName = (nameSingular: string): boolean =>
  (VIDEO_INTERVIEW_OBJECT_NAME_SINGULARS as readonly string[]).includes(
    nameSingular,
  );

export const isVideoInterviewHostExtensionField = ({
  objectName,
  fieldName,
}: {
  objectName: string;
  fieldName: string;
}): boolean =>
  VIDEO_INTERVIEW_HOST_EXTENSION_FIELDS.some(
    (field) =>
      field.objectName === objectName && field.fieldName === fieldName,
  );

export const isVideoInterviewRelation = ({
  fromObjectName,
  toObjectName,
}: {
  fromObjectName: string;
  toObjectName: string;
}): boolean =>
  isVideoInterviewObjectName(fromObjectName) ||
  isVideoInterviewObjectName(toObjectName);
