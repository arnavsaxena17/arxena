import { Page } from '@playwright/test';

export const getAuthToken = async (page: Page) => {
  const decodeToken = (cookieValue?: string | null) => {
    if (!cookieValue) {
      return null;
    }

    try {
      return JSON.parse(decodeURIComponent(cookieValue)).accessToken.token;
    } catch {
      return null;
    }
  };

  const storageState = await page.context().storageState();
  const storageCookie = storageState.cookies.find(
    (cookie) => cookie.name === 'tokenPair',
  );
  const storageToken = decodeToken(storageCookie?.value);

  if (storageToken) {
    return { authToken: storageToken };
  }

  const liveCookies = await page.context().cookies([
    page.url() || 'http://testing-arxena.localhost:3001',
    'http://testing-arxena.localhost:3001',
    'http://app.localhost:3001',
    'http://cool-panda.localhost:3001',
    'http://localhost:3001',
  ]);
  const liveCookie = liveCookies.find((cookie) => cookie.name === 'tokenPair');
  const liveToken = decodeToken(liveCookie?.value);

  if (liveToken) {
    return { authToken: liveToken };
  }

  const pageCookieValue = await page
    .evaluate(() => {
      const tokenPairEntry = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith('tokenPair='));

      return tokenPairEntry
        ? tokenPairEntry.slice('tokenPair='.length)
        : null;
    })
    .catch(() => null);
  const pageToken = decodeToken(pageCookieValue);

  if (!pageToken) {
    throw new Error('No auth cookie found');
  }

  return { authToken: pageToken };
};
