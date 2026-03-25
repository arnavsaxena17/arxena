import { chromium } from 'playwright';

const email = process.env.CHATWOOT_EMAIL;
const password = process.env.CHATWOOT_PASSWORD;

if (!email || !password) {
  throw new Error('CHATWOOT_EMAIL and CHATWOOT_PASSWORD are required');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleMessages = [];
page.on('console', (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});

console.log('step:login-page');
await page.goto('https://support.arxena.com/app/login', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
console.log(
  'login-body:',
  (
    await page.locator('body').innerText().catch(() => '')
  ).slice(0, 1000)
);
console.log(
  'inputs:',
  JSON.stringify(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map(input => ({
        type: input.getAttribute('type'),
        name: input.getAttribute('name'),
        placeholder: input.getAttribute('placeholder'),
        autocomplete: input.getAttribute('autocomplete'),
      }))
    )
  )
);

console.log('step:fill-creds');
await page.locator('input').nth(0).fill(email, { timeout: 10000 });
await page.locator('input').nth(1).fill(password, { timeout: 10000 });

console.log('step:submit');
await page.getByRole('button', { name: /login|sign in/i }).click({
  timeout: 10000,
  noWaitAfter: true,
});
await page.waitForTimeout(3000);

console.log('step:captain-page');
await page.goto('https://support.arxena.com/app/accounts/1/captain/assistants', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.waitForTimeout(3000);

const bodyText = await page.locator('body').innerText();

console.log(
  JSON.stringify(
    {
      url: page.url(),
      hasUpgradeWall: bodyText.includes('Upgrade to use Captain AI'),
      bodySnippet: bodyText.slice(0, 2000),
      consoleMessages,
    },
    null,
    2,
  ),
);

await browser.close();
