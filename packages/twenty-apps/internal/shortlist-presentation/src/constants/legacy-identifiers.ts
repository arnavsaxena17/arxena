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

export const SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('shortlist');

export const CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('cvSent');

export const SCREENING_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('screening');

export const CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('candidateEnrichment');

export const PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER =
  getLegacyObjectUniversalIdentifier('phoneCall');

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
