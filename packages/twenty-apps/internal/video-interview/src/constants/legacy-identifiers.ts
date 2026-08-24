import {
  getFieldUniversalIdentifier,
  getObjectUniversalIdentifier,
  getSelectOptionUniversalIdentifier,
} from 'twenty-shared/application';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';

export const getLegacyObjectUniversalIdentifier = (
  nameSingular: string,
): string =>
  getObjectUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    nameSingular,
  });

export const CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('candidate');

export const PROJECT_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('project');

export const VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('videoInterviewModel');

export const VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('videoInterviewTemplate');

export const VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('videoInterviewQuestion');

export const VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('videoInterview');

export const VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('videoInterviewResponse');

export const getLegacyFieldUniversalIdentifier = ({
  objectUniversalIdentifier,
  name,
}: {
  objectUniversalIdentifier: string;
  name: string;
}): string =>
  getFieldUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier,
    name,
  });

export const getLegacySelectOptionUniversalIdentifier = ({
  fieldUniversalIdentifier,
  value,
}: {
  fieldUniversalIdentifier: string;
  value: string;
}): string =>
  getSelectOptionUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    fieldUniversalIdentifier,
    value,
  });
