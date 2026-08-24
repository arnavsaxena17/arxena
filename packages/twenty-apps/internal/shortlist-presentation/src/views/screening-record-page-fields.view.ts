import {
  getFieldsWidgetViewUniversalIdentifier,
  getPageLayoutTabUniversalIdentifier,
  getPageLayoutWidgetUniversalIdentifier,
  getRecordPageLayoutUniversalIdentifier,
  getViewFieldUniversalIdentifier,
} from 'twenty-shared/application';
import { defineView } from 'twenty-sdk/define';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import {
  getLegacyFieldUniversalIdentifier,
  SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const pageLayoutUniversalIdentifier = getRecordPageLayoutUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
});

const homeTabUniversalIdentifier = getPageLayoutTabUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier,
  title: 'Home',
});

const fieldsWidgetUniversalIdentifier = getPageLayoutWidgetUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  pageLayoutTabUniversalIdentifier: homeTabUniversalIdentifier,
  title: 'Fields',
});

const fieldsViewUniversalIdentifier = getFieldsWidgetViewUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  pageLayoutWidgetUniversalIdentifier: fieldsWidgetUniversalIdentifier,
});

export default defineView({
  universalIdentifier: fieldsViewUniversalIdentifier,
  name: 'Record page fields',
  objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
  type: 'TABLE',
  icon: 'IconList',
  position: 1,
  fields: [
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'candidate',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'candidate',
      }),
      position: 0,
      isVisible: true,
      size: 100,
    }
  ],
});
