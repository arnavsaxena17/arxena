const { chromium } = require('@playwright/test');

const PASSWORD = 'Applecar2025';
const BASE_URL = 'http://localhost:3001';

const branches = [
  {
    id: 'competitive-research',
    intentButton: 'Competitive research',
    pathUrl: /\/create\/competitive-research(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-competitive-research',
  },
  {
    id: 'extension-install',
    intentButton: 'Install the browser extension',
    pathUrl: /\/create\/extension-install(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-extension-install',
  },
  {
    id: 'deal-diligence',
    intentButton: 'Deal diligence',
    pathUrl: /\/create\/deal-diligence(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-deal-diligence',
  },
];

const maybeClick = async (locator) => {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }

  return false;
};

const clickContinueToJobs = async (page) => {
  let lastError;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      for (const name of ['Continue to Jobs', 'Go to jobs']) {
        const button = page.getByRole('button', { name });
        if (await button.isVisible().catch(() => false)) {
          await button.click({ timeout: 30_000 });
          return;
        }
      }
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No jobs continuation button was visible');
};

const signUpAndReachIntentChoice = async (page, runId) => {
  const email = `intent_${runId}@arxena-e2e.test`;
  const workspaceName = `Intent ${runId}`;

  await page.goto(`${BASE_URL}/welcome`);
  await page.waitForLoadState('domcontentloaded');

  await maybeClick(page.getByRole('button', { name: 'Continue with Email' }));

  await page.getByPlaceholder('Email').fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByPlaceholder('Password').fill(PASSWORD);

  if (!(await maybeClick(page.getByRole('button', { name: 'Sign up' })))) {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  await page.getByText('Create your workspace').waitFor({ timeout: 120_000 });
  await page.getByPlaceholder('Apple').fill(workspaceName);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByText('Create profile').waitFor({ timeout: 120_000 });
  await page.locator('input[placeholder="Tim"]').first().fill('Intent');
  await page.locator('input[placeholder="Cook"]').first().fill('Verifier');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByText('Add your phone number').waitFor({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Skip' }).click();

  await page.waitForURL(/\/create\/intent(?:[/?#]|$)/, {
    timeout: 120_000,
  });
  await page
    .getByTestId('onboarding-intent-choice')
    .waitFor({ timeout: 120_000 });
};

const verifyBranch = async (browser, branch) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const runId = `${branch.id.replace(/[^a-z]/g, '')}_${Date.now()}`;

  try {
    await signUpAndReachIntentChoice(page, runId);

    await page.getByRole('button', { name: branch.intentButton }).click();
    await page.waitForURL(branch.pathUrl, { timeout: 120_000 });
    await page.getByTestId(branch.pathTestId).waitFor({ timeout: 120_000 });

    await clickContinueToJobs(page);

    await page.waitForURL(/\/jobs(?:[/?#]|$)/, { timeout: 120_000 });

    return {
      branch: branch.id,
      success: true,
      finalUrl: page.url(),
    };
  } catch (error) {
    return {
      branch: branch.id,
      success: false,
      finalUrl: page.url(),
      error:
        error instanceof Error ? error.stack || error.message : String(error),
    };
  } finally {
    await context.close();
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const branch of branches) {
      const result = await verifyBranch(browser, branch);
      results.push(result);
      console.log(JSON.stringify(result));
    }
  } finally {
    await browser.close();
  }

  const failedResults = results.filter((result) => !result.success);

  if (failedResults.length > 0) {
    process.exitCode = 1;
  }
})();
