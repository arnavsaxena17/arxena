export interface ArxenaConfig {
  apiToken: string;
  baseUrl: string;
  workspaceMemberId?: string;
  // Tools the server has switched off (IS_SEARCH_*_ENABLED). When provided the library
  // trusts it; otherwise it asks the server over HTTP and caches the answer for a minute.
  disabledToolNames?: readonly string[];
}
