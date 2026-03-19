#!/usr/bin/env node
/**
 * refresh-dev-auth.mjs
 *
 * Logs in via the GraphQL API and saves a fresh tokenPair to .auth/dev-token.json.
 * Used by Claude Code (preview tool) at the start of each dev session so it can
 * navigate to authenticated app pages without being redirected to /welcome.
 *
 * Usage:
 *   node packages/twenty-e2e-testing/scripts/refresh-dev-auth.mjs
 *
 * Environment variables (all optional – defaults match the local dev setup):
 *   BACKEND_BASE_URL   - e.g. http://localhost:3000  (default)
 *   WORKSPACE_ORIGIN   - e.g. http://cool-panda.localhost:3001  (default)
 *                        Must match a workspace subdomain so the backend can
 *                        resolve the correct workspace.
 *   DEFAULT_LOGIN      - email address (default: arnav@arxena.com)
 *   DEFAULT_PASSWORD   - password      (default: Applecar2025)
 *
 * After running, paste the printed document.cookie line into preview_eval
 * before navigating to any authenticated page.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BACKEND_URL = process.env.BACKEND_BASE_URL || 'http://localhost:3000';
const WORKSPACE_ORIGIN =
  process.env.WORKSPACE_ORIGIN || 'http://cool-panda.localhost:3001';
const EMAIL = process.env.DEFAULT_LOGIN || 'arnav@arxena.com';
const PASSWORD = process.env.DEFAULT_PASSWORD || 'Applecar2025';

async function gql(query, variables = {}, operationName) {
  const res = await fetch(`${BACKEND_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WORKSPACE_ORIGIN,
    },
    body: JSON.stringify({ operationName, query, variables }),
  });
  const data = await res.json();
  if (data.errors?.length) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
    process.exit(1);
  }
  return data.data;
}

async function main() {
  console.log(`Logging in as ${EMAIL} ...`);
  console.log(`  Backend : ${BACKEND_URL}`);
  console.log(`  Origin  : ${WORKSPACE_ORIGIN}`);

  // Step 1: Get a short-lived login token from credentials
  const step1 = await gql(
    `mutation GetLoginTokenFromCredentials($email: String!, $password: String!) {
       getLoginTokenFromCredentials(email: $email, password: $password) {
         loginToken { token expiresAt }
       }
     }`,
    { email: EMAIL, password: PASSWORD },
    'GetLoginTokenFromCredentials',
  );

  const loginToken =
    step1?.getLoginTokenFromCredentials?.loginToken?.token;
  if (!loginToken) {
    console.error('No loginToken returned – check credentials / server.');
    process.exit(1);
  }

  // Step 2: Exchange login token for a full accessToken + refreshToken pair
  const step2 = await gql(
    `mutation GetAuthTokensFromLoginToken($loginToken: String!) {
       getAuthTokensFromLoginToken(loginToken: $loginToken) {
         tokens {
           accessToken  { token expiresAt }
           refreshToken { token expiresAt }
         }
       }
     }`,
    { loginToken },
    'GetAuthTokensFromLoginToken',
  );

  const tokens = step2?.getAuthTokensFromLoginToken?.tokens;
  if (!tokens) {
    console.error('No tokens returned from getAuthTokensFromLoginToken.');
    process.exit(1);
  }

  const tokenPair = {
    __typename: 'AuthTokenPair',
    accessToken: {
      __typename: 'AuthToken',
      token: tokens.accessToken.token,
      expiresAt: tokens.accessToken.expiresAt,
    },
    refreshToken: {
      __typename: 'AuthToken',
      token: tokens.refreshToken.token,
      expiresAt: tokens.refreshToken.expiresAt,
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(tokenPair));

  // Persist to disk – both the structured object and the encoded cookie value
  const outPath = resolve(__dirname, '..', '.auth', 'dev-token.json');
  writeFileSync(
    outPath,
    JSON.stringify({ tokenPair, encoded, savedAt: new Date().toISOString() }, null, 2),
  );

  console.log('\n✓ Token saved to:', outPath);
  console.log('  Access token expires :', tokenPair.accessToken.expiresAt);
  console.log('  Refresh token expires:', tokenPair.refreshToken.expiresAt);

  // domain=.localhost makes the cookie visible across all *.localhost subdomains
  const cookieLine = `document.cookie = "tokenPair=${encoded}; domain=.localhost; path=/; SameSite=Lax; expires=" + new Date("${tokenPair.accessToken.expiresAt}").toUTCString();`;

  console.log('\n─── Paste into preview_eval to authenticate the browser ───');
  console.log(cookieLine);
  console.log('──────────────────────────────────────────────────────────');
  console.log(`\nThen navigate to: ${WORKSPACE_ORIGIN}/assistant`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
