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
  VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const pageLayoutUniversalIdentifier = getRecordPageLayoutUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
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
  objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: 'TABLE',
  icon: 'IconList',
  position: 1,
  fields: [
    {
      universalIdentifier: getViewFieldUniversalIdentifier({
        applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        viewUniversalIdentifier: fieldsViewUniversalIdentifier,
        fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'questionType',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'questionType',
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
          objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'answerType',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'answerType',
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
          objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'timeLimit',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'timeLimit',
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
          objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'questionValue',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'questionValue',
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
          objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'retakes',
        }),
      }),
      fieldMetadataUniversalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'retakes',
      }),
      position: 4,
      isVisible: true,
      size: 100,
    }
  ],
});
