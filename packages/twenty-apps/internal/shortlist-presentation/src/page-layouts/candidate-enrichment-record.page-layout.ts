import {
  getFieldsWidgetViewUniversalIdentifier,
  getPageLayoutTabUniversalIdentifier,
  getPageLayoutWidgetUniversalIdentifier,
  getRecordPageLayoutUniversalIdentifier,
} from 'twenty-shared/application';
import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';

const pageLayoutUniversalIdentifier = getRecordPageLayoutUniversalIdentifier({
  applicationUniversalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
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

export default definePageLayout({
  universalIdentifier: pageLayoutUniversalIdentifier,
  name: 'Default AI Filter Layout',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  tabs: [
      {
        universalIdentifier: getPageLayoutTabUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          pageLayoutUniversalIdentifier,
          title: 'Home',
        }),
        title: 'Home',
        position: 10,
        icon: 'IconHome',
        layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
        widgets: [
          {
            universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
              applicationUniversalIdentifier:
                ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
              pageLayoutTabUniversalIdentifier: getPageLayoutTabUniversalIdentifier({
                applicationUniversalIdentifier:
                  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
                pageLayoutUniversalIdentifier,
                title: 'Home',
              }),
              title: 'Fields',
            }),
            title: 'Fields',
            type: 'FIELDS',
            objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
            gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'FIELDS',
            viewUniversalIdentifier: fieldsViewUniversalIdentifier,
            newFieldDefaultVisibility: true,
          },
          },
        ],
      },
      {
        universalIdentifier: getPageLayoutTabUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          pageLayoutUniversalIdentifier,
          title: 'Timeline',
        }),
        title: 'Timeline',
        position: 20,
        icon: 'IconTimelineEvent',
        layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
        widgets: [
          {
            universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
              applicationUniversalIdentifier:
                ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
              pageLayoutTabUniversalIdentifier: getPageLayoutTabUniversalIdentifier({
                applicationUniversalIdentifier:
                  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
                pageLayoutUniversalIdentifier,
                title: 'Timeline',
              }),
              title: 'Timeline',
            }),
            title: 'Timeline',
            type: 'TIMELINE',
            objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
            gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'TIMELINE',
          },
          },
        ],
      },
      {
        universalIdentifier: getPageLayoutTabUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          pageLayoutUniversalIdentifier,
          title: 'Tasks',
        }),
        title: 'Tasks',
        position: 30,
        icon: 'IconCheckbox',
        layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
        widgets: [
          {
            universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
              applicationUniversalIdentifier:
                ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
              pageLayoutTabUniversalIdentifier: getPageLayoutTabUniversalIdentifier({
                applicationUniversalIdentifier:
                  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
                pageLayoutUniversalIdentifier,
                title: 'Tasks',
              }),
              title: 'Tasks',
            }),
            title: 'Tasks',
            type: 'TASKS',
            objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
            gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'TASKS',
          },
          },
        ],
      },
      {
        universalIdentifier: getPageLayoutTabUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          pageLayoutUniversalIdentifier,
          title: 'Notes',
        }),
        title: 'Notes',
        position: 40,
        icon: 'IconNotes',
        layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
        widgets: [
          {
            universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
              applicationUniversalIdentifier:
                ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
              pageLayoutTabUniversalIdentifier: getPageLayoutTabUniversalIdentifier({
                applicationUniversalIdentifier:
                  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
                pageLayoutUniversalIdentifier,
                title: 'Notes',
              }),
              title: 'Notes',
            }),
            title: 'Notes',
            type: 'NOTES',
            objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
            gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'NOTES',
          },
          },
        ],
      },
      {
        universalIdentifier: getPageLayoutTabUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          pageLayoutUniversalIdentifier,
          title: 'Files',
        }),
        title: 'Files',
        position: 50,
        icon: 'IconPaperclip',
        layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
        widgets: [
          {
            universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
              applicationUniversalIdentifier:
                ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
              pageLayoutTabUniversalIdentifier: getPageLayoutTabUniversalIdentifier({
                applicationUniversalIdentifier:
                  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
                pageLayoutUniversalIdentifier,
                title: 'Files',
              }),
              title: 'Files',
            }),
            title: 'Files',
            type: 'FILES',
            objectUniversalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
            gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
          configuration: {
            configurationType: 'FILES',
          },
          },
        ],
      }
  ],
});
