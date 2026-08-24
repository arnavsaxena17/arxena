import {
  getIndexViewUniversalIdentifier,
  getViewFieldUniversalIdentifier,
} from 'twenty-shared/application';
import { defineView, ViewKey } from 'twenty-sdk/define';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import {
  getLegacyFieldUniversalIdentifier,
  PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const indexViewUniversalIdentifier = getIndexViewUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
});

export default defineView({
  universalIdentifier: indexViewUniversalIdentifier,
  name: 'All {objectLabelPlural}',
  objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
  type: 'TABLE',
  key: ViewKey.INDEX,
  icon: 'IconList',
  position: 0,
  fields: [
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: indexViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'name',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'name',
      }),
      position: 0,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: indexViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'callType',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'callType',
      }),
      position: 1,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: indexViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'person',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'person',
      }),
      position: 2,
      isVisible: true,
      size: 100,
    }
  ],
});
