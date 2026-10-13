import { type RestTransport } from './api/rest-client';

export interface ArxenaConfig {
  apiToken: string;
  baseUrl: string;
  workspaceMemberId?: string;
  // Tools the server has switched off (IS_SEARCH_*_ENABLED). When provided the library
  // trusts it; otherwise it asks the server over HTTP and caches the answer for a minute.
  disabledToolNames?: readonly string[];
  // Answers REST routes in process; routes it does not answer still use baseUrl over HTTP.
  restTransport?: RestTransport;
}
