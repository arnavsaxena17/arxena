import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleMessages = [];
const failedRequests = [];
const responses = [];

page.on('console', (msg) => {
  consoleMessages.push({
    type: msg.type(),
    text: msg.text(),
  });
});

page.on('requestfailed', (request) => {
  failedRequests.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  });
});

page.on('response', async (response) => {
  const url = response.url();
  if (
    url.includes('support.arxena.com') ||
    url.includes('chatwoot') ||
    url.includes('/widget')
  ) {
    responses.push({
      url,
      status: response.status(),
      headers: await response.allHeaders(),
    });
  }
});

await page.goto('https://arxena.com', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

await page.waitForTimeout(4000);

await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight);
});

await page.getByText('Chat with us').first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(5000);

const frameInfo = await page.evaluate(() => {
  const iframe = document.querySelector('iframe');
  return {
    iframeCount: document.querySelectorAll('iframe').length,
    iframeSrc: iframe?.getAttribute('src') ?? null,
    hasChatwootSdk: typeof window.chatwootSDK !== 'undefined',
    hasChatwootApi: typeof window.$chatwoot !== 'undefined',
    env: window.__ENV ?? null,
  };
});

console.log(JSON.stringify({ frameInfo, consoleMessages, failedRequests, responses }, null, 2));

await browser.close();
