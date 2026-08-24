import {
  getIndexViewUniversalIdentifier,
  getViewFieldUniversalIdentifier,
} from 'twenty-shared/application';
import { defineView, ViewKey } from 'twenty-sdk/define';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import {
  getLegacyFieldUniversalIdentifier,
  SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const indexViewUniversalIdentifier = getIndexViewUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
});

export default defineView({
  universalIdentifier: indexViewUniversalIdentifier,
  name: 'All {objectLabelPlural}',
  objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
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
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'name',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
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
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'fullName',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'fullName',
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
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'currentJobTitle',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'currentJobTitle',
      }),
      position: 2,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: indexViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'currentCompany',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'currentCompany',
      }),
      position: 3,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: indexViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'currentLocation',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'currentLocation',
      }),
      position: 4,
      isVisible: true,
      size: 100,
    }
  ],
});
