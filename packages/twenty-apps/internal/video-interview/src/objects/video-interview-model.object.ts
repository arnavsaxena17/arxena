import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  getLegacySelectOptionUniversalIdentifier,
  VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const VIDEO_INTERVIEW_MODEL_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier:
      VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

const countryFieldUniversalIdentifier = getLegacyFieldUniversalIdentifier({
  objectUniversalIdentifier: VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'country',
});

const languageFieldUniversalIdentifier = getLegacyFieldUniversalIdentifier({
  objectUniversalIdentifier: VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'language',
});

export default defineObject({
  universalIdentifier: VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'videoInterviewModel',
  namePlural: 'videoInterviewModels',
  labelSingular: 'Video Interview Model',
  labelPlural: 'Video Interview Models',
  description: 'Avatar persona used on video interview templates',
  icon: 'IconCode',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_MODEL_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        VIDEO_INTERVIEW_MODEL_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: countryFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'country',
      label: 'Country',
      icon: 'IconFlag',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: countryFieldUniversalIdentifier,
            value: 'IN',
          }),
          color: 'green',
          label: 'India',
          position: 0,
          value: 'IN',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: countryFieldUniversalIdentifier,
            value: 'US',
          }),
          color: 'turquoise',
          label: 'United States',
          position: 1,
          value: 'US',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: countryFieldUniversalIdentifier,
            value: 'GB',
          }),
          color: 'sky',
          label: 'United Kingdom',
          position: 2,
          value: 'GB',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: countryFieldUniversalIdentifier,
            value: 'JP',
          }),
          color: 'blue',
          label: 'Japan',
          position: 3,
          value: 'JP',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: countryFieldUniversalIdentifier,
            value: 'FR',
          }),
          color: 'purple',
          label: 'France',
          position: 4,
          value: 'FR',
        },
      ],
    },
    {
      universalIdentifier: languageFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'language',
      label: 'Language',
      icon: 'IconLanguage',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: languageFieldUniversalIdentifier,
            value: 'ENGLISH_UNITED_STATES',
          }),
          color: 'green',
          label: 'English (United States)',
          position: 0,
          value: 'ENGLISH_UNITED_STATES',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: languageFieldUniversalIdentifier,
            value: 'ENGLISH_UNITED_KINGDOM',
          }),
          color: 'turquoise',
          label: 'English (United Kingdom)',
          position: 1,
          value: 'ENGLISH_UNITED_KINGDOM',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: languageFieldUniversalIdentifier,
            value: 'HINDI',
          }),
          color: 'sky',
          label: 'Hindi',
          position: 2,
          value: 'HINDI',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: languageFieldUniversalIdentifier,
            value: 'JAPANESE',
          }),
          color: 'blue',
          label: 'Japanese',
          position: 3,
          value: 'JAPANESE',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: languageFieldUniversalIdentifier,
            value: 'FRENCH',
          }),
          color: 'purple',
          label: 'French',
          position: 4,
          value: 'FRENCH',
        },
      ],
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterviewTemplate',
      }),
      type: FieldType.RELATION,
      name: 'videoInterviewTemplate',
      label: 'Video Interview Template',
      icon: 'IconScan',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier:
            VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'videoInterviewModel',
        }),
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
