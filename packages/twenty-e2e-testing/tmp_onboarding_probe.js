const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: 'http://localhost:3001' });
  const logs = [];
  page.on('pageerror', (err) => logs.push('PAGEERROR ' + (err.stack || err.message)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.push('CONSOLE ' + msg.text());
  });

  const password = 'Applecar2025';
  const email = 'dbg5_' + Date.now() + '@arxena-e2e.test';
  const workspaceName = 'DBG5 ' + Date.now();

  await page.goto('http://localhost:3001/welcome');
  console.log('STEP welcome');
  const continueWithEmailButton = page.getByRole('button', { name: 'Continue with Email' });
  if (await continueWithEmailButton.isVisible().catch(() => false)) await continueWithEmailButton.click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  console.log('STEP email-submitted');
  await page.getByPlaceholder('Password').fill(password);
  const signUpButton = page.getByRole('button', { name: 'Sign up' });
  if (await signUpButton.isVisible().catch(() => false)) await signUpButton.click();
  else await page.getByRole('button', { name: 'Continue', exact: true }).click();
  console.log('STEP signup-submitted');

  for (let i = 0; i < 80; i++) {
    if (await page.getByText('Create your workspace').isVisible().catch(() => false)) {
      await page.getByPlaceholder('Apple').fill(workspaceName);
      await page.getByRole('button', { name: 'Continue' }).click({ noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(1000);
      console.log('STEP workspace-continue');
      continue;
    }
    if (await page.getByText('Create profile').isVisible().catch(() => false)) {
      await page.locator('input[placeholder="Tim"]').first().fill('Dbg');
      await page.locator('input[placeholder="Cook"]').first().fill('User');
      await page.getByRole('button', { name: 'Continue' }).click({ noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(1000);
      console.log('STEP profile-continue');
      continue;
    }
    if (await page.getByText('Add your phone number').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Skip' }).click();
      await page.waitForTimeout(1000);
      console.log('STEP phone-skip');
      continue;
    }
    if (page.url().endsWith('/create/intent')) break;
    await page.waitForTimeout(500);
  }

  console.log('STEP intent-visible', page.url());
  await page.getByRole('button', { name: 'Competitive research' }).click();
  console.log('STEP intent-selected', page.url());
  await page.getByTestId('onboarding-path-competitive-research').waitFor({
    state: 'visible',
    timeout: 120000,
  });
  console.log('STEP path-visible', page.url());
  const pathInfo = await page.evaluate(() => {
    const pathNode = document.querySelector(
      '[data-testid="onboarding-path-competitive-research"]',
    );
    const root = document.querySelector('#root');
    const button = Array.from(document.querySelectorAll('button')).find(
      (el) => el.textContent?.includes('Continue to Jobs'),
    );

    return {
      bodyText: document.body.innerText,
      rootHtml: root?.innerHTML.slice(0, 4000),
      pathHtml: pathNode?.outerHTML,
      pathText: pathNode?.textContent,
      pathStyle: pathNode ? window.getComputedStyle(pathNode) : null,
      buttonText: button?.textContent,
      buttonStyle: button ? window.getComputedStyle(button) : null,
    };
  });
  console.log('PATH_INFO', JSON.stringify(pathInfo, null, 2));

  const bodyText = await page.locator('body').innerText();
  const rootHtml = await page.locator('#root').innerHTML();
  const testIds = await page.locator('[data-testid]').evaluateAll((els) => els.map((el) => ({
    testid: el.getAttribute('data-testid'),
    text: el.textContent,
    html: el.outerHTML.slice(0, 300),
  })));

  console.log('URL', page.url());
  console.log('BODY', JSON.stringify(bodyText));
  console.log('TESTIDS', JSON.stringify(testIds, null, 2));
  console.log('ROOT', rootHtml.slice(0, 3000));
  console.log('LOGS', JSON.stringify(logs, null, 2));

  await browser.close();
})();
