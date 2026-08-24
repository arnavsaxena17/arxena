import {
  getPageLayoutTabUniversalIdentifier,
  getPageLayoutWidgetUniversalIdentifier,
  getRecordPageLayoutUniversalIdentifier,
} from 'twenty-shared/application';
import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/application';
import { PROJECT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { TEMPLATE_BUILDER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/video-interview-template-builder.front-component';

const projectRecordPageLayoutUniversalIdentifier =
  getRecordPageLayoutUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  });

const tabUniversalIdentifier = getPageLayoutTabUniversalIdentifier({
  applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier: projectRecordPageLayoutUniversalIdentifier,
  title: 'Video Interview',
});

export default definePageLayoutTab({
  universalIdentifier: tabUniversalIdentifier,
  title: 'Video Interview',
  position: 80,
  icon: 'IconVideo',
  layoutMode: PageLayoutTabLayoutMode.CANVAS,
  pageLayoutUniversalIdentifier: projectRecordPageLayoutUniversalIdentifier,
  widgets: [
    {
      universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
        applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
        pageLayoutTabUniversalIdentifier: tabUniversalIdentifier,
        title: 'Template',
      }),
      title: 'Template',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier:
          TEMPLATE_BUILDER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
