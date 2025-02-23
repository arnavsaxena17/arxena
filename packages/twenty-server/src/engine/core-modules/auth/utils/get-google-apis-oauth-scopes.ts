export const getGoogleApisOauthScopes = () => {
  return [
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',

    'https://www.googleapis.com/auth/calendar.events',

    'https://www.googleapis.com/auth/profile.emails.read',

    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/contacts',
    // 'https://www.googleapis.com/auth/script.deployments',
    'https://www.googleapis.com/auth/drive',
    // 'https://www.googleapis.com/auth/script.external_request',
    // 'https://www.googleapis.com/auth/spreadsheets',
    // 'https://www.googleapis.com/auth/script.projects',
  ];
};
