import {
  getIndexViewUniversalIdentifier,
  getViewFieldUniversalIdentifier,
} from 'twenty-shared/application';
import { defineView, ViewKey } from 'twenty-sdk/define';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import {
  getLegacyFieldUniversalIdentifier,
  SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const indexViewUniversalIdentifier = getIndexViewUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
});

export default defineView({
  universalIdentifier: indexViewUniversalIdentifier,
  name: 'All {objectLabelPlural}',
  objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
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
          objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'name',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
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
          objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'candidate',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'candidate',
      }),
      position: 1,
      isVisible: true,
      size: 100,
    }
  ],
});
