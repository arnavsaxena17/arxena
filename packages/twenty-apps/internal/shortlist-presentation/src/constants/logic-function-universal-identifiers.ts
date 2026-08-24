import { getLogicFunctionUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';

export const POPULATE_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'populate-shortlist',
  });

export const SHARE_CHAT_BASED_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'share-chat-based-shortlist',
  });

export const CREATE_SHORTLIST_DOCUMENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'create-shortlist-document',
  });

export const DOWNLOAD_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'download-shortlist',
  });

export const DOWNLOAD_CANDIDATE_CVS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'download-candidate-cvs',
  });

export const CREATE_CV_SENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'create-cv-sent',
  });

export const SET_CANDIDATE_STATUS_CV_SENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  getLogicFunctionUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    name: 'set-candidate-status-cv-sent',
  });
