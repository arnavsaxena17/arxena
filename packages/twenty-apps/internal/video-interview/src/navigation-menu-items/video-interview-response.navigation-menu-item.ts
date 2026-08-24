import {
  getObjectNavigationMenuItemUniversalIdentifier,
} from 'twenty-shared/application';
import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { NavigationMenuItemType } from 'twenty-shared/types';

import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/legacy-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: getObjectNavigationMenuItemUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
  }),
  type: NavigationMenuItemType.OBJECT,
  position: 4,
  targetObjectUniversalIdentifier: VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
});
