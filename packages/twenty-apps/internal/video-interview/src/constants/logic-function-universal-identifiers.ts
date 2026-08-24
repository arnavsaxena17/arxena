import { getLogicFunctionUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';

export const CREATE_VIDEO_INTERVIEW_LINKS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'create-video-interview-links',
  });

export const SHARE_VIDEO_INTERVIEW_LINKS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'share-video-interview-links',
  });

export const CREATE_INTERVIEWER_AVATAR_VIDEOS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'create-interviewer-avatar-videos',
  });
