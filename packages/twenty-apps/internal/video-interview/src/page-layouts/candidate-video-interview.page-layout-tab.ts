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
import { CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';
import { CANDIDATE_REVIEW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/video-interview-candidate-review.front-component';

const candidateRecordPageLayoutUniversalIdentifier =
  getRecordPageLayoutUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  });

const tabUniversalIdentifier = getPageLayoutTabUniversalIdentifier({
  applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier: candidateRecordPageLayoutUniversalIdentifier,
  title: 'Video Interview',
});

export default definePageLayoutTab({
  universalIdentifier: tabUniversalIdentifier,
  title: 'Video Interview',
  position: 80,
  icon: 'IconVideo',
  layoutMode: PageLayoutTabLayoutMode.CANVAS,
  pageLayoutUniversalIdentifier: candidateRecordPageLayoutUniversalIdentifier,
  widgets: [
    {
      universalIdentifier: getPageLayoutWidgetUniversalIdentifier({
        applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
        pageLayoutTabUniversalIdentifier: tabUniversalIdentifier,
        title: 'Responses',
      }),
      title: 'Responses',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier:
          CANDIDATE_REVIEW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
