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

export const PROJECT_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('project');

export const ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('assistantThread');

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
