/** email, profile and openid permission can be called without the https://www.googleapis.com/auth/ prefix
 * see https://developers.google.com/identity/protocols/oauth2/scopes
 *
 * Keep this list identical to what the OAuth consent screen was verified for. Requesting a scope
 * that was not approved fails review, and each extra scope is another one to justify and to demo.
 * See google-verification/2-scope-audit.md for why every entry below is here.
 */
export const getGoogleApisOauthScopes = () => {
  return [
    // identity, not tied to a Google API
    'email',
    'profile',
    // read mail, labels and send-as settings — the message import and the Emails tab
    'https://www.googleapis.com/auth/gmail.readonly',
    // send a reply composed in the CRM
    'https://www.googleapis.com/auth/gmail.send',
    // drafts, written by the workflow "draft email" action. Drop this line and the action
    // together if drafts are not part of the release.
    'https://www.googleapis.com/auth/gmail.compose',
    // events on the primary calendar only; the app never lists calendars or reads ACLs
    'https://www.googleapis.com/auth/calendar.events',
    // "Add to Google Contacts": read to de-duplicate, then write into a contact group
    'https://www.googleapis.com/auth/contacts',
  ];
};
