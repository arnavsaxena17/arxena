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
  SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const pageLayoutUniversalIdentifier = getRecordPageLayoutUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
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
  objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
  type: 'TABLE',
  icon: 'IconList',
  position: 1,
  fields: [
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'fullName',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'fullName',
      }),
      position: 0,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'yearsOfExperience',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'yearsOfExperience',
      }),
      position: 1,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
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
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
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
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'expectedSalary',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'expectedSalary',
      }),
      position: 4,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'noticePeriod',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'noticePeriod',
      }),
      position: 5,
      isVisible: true,
      size: 100,
    }
  ],
});
