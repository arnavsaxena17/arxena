const { chromium } = require('@playwright/test');
const { execSync } = require('node:child_process');

const PASSWORD = 'Applecar2025';

const nextEmail = () => {
  const output = execSync(
    `PGPASSWORD=postgres psql -h localhost -U postgres -d default -t -A -c "select coalesce(max(nullif(substring(email from '^apple([0-9]+)@apple\\\\.com$'), '')::int), 0) from core.\\"user\\" where email ~ '^apple[0-9]+@apple\\\\.com$';"`,
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();

  const maxIndex = Number.parseInt(output, 10);

  return `apple${(Number.isNaN(maxIndex) ? 0 : maxIndex) + 1}@apple.com`;
};

(async () => {
  const email = nextEmail();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  });

  try {
    await page.goto('http://app.localhost:3001/welcome');
    await page.waitForLoadState('domcontentloaded');

    const continueWithEmail = page.getByRole('button', {
      name: 'Continue with Email',
    });

    if (await continueWithEmail.isVisible().catch(() => false)) {
      await continueWithEmail.click();
    }

    await page.getByPlaceholder('Email').fill(email);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByPlaceholder('Password').fill(PASSWORD);

    const signUp = page.getByRole('button', { name: 'Sign up' });

    if (await signUp.isVisible().catch(() => false)) {
      await signUp.click();
    } else {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }

    await page.getByText('Create your workspace').waitFor({ timeout: 120_000 });
    await page.getByPlaceholder('Apple').fill('Apple debug');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByText('Create profile').waitFor({ timeout: 120_000 });
    await page.locator('input[placeholder="Tim"]').first().fill('Apple');
    await page.locator('input[placeholder="Cook"]').first().fill('Debug');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByText('Add your phone number').waitFor({ timeout: 120_000 });
    await page.getByRole('button', { name: 'Skip' }).click();

    await page.waitForURL(/\/create\/intent(?:[/?#]|$)/, {
      timeout: 120_000,
    });

    await page.getByRole('button', { name: 'Competitive research' }).click();
    await page.waitForURL(/\/create\/competitive-research(?:[/?#]|$)/, {
      timeout: 120_000,
    });

    await page.waitForTimeout(5_000);

    const bodyText = await page.locator('body').innerText();
    const buttons = await page.locator('button').evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent,
        ariaLabel: element.getAttribute('aria-label'),
        disabled: element.hasAttribute('disabled'),
      })),
    );
    const competitiveResearchVisible = await page
      .getByTestId('onboarding-path-competitive-research')
      .isVisible()
      .catch(() => false);

    console.log(
      JSON.stringify(
        {
          email,
          url: page.url(),
          competitiveResearchVisible,
          bodyText: bodyText.slice(0, 3000),
          buttons,
          consoleMessages,
          pageErrors,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await browser.close();
  }
})();
