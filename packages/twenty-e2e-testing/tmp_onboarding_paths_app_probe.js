const { chromium } = require('@playwright/test');
const { execSync } = require('node:child_process');

const PASSWORD = 'Applecar2025';
const BASE_URL = 'http://app.localhost:3001';
const getNextAppleIndex = () => {
  const output = execSync(
    `PGPASSWORD=postgres psql -h localhost -U postgres -d default -t -A -c "select coalesce(max(nullif(substring(email from '^apple([0-9]+)@apple\\\\.com$'), '')::int), 0) as max_index from core.\\"user\\" where email ~ '^apple[0-9]+@apple\\\\.com$';"`,
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();

  const maxIndex = Number.parseInt(output, 10);

  return Number.isNaN(maxIndex) ? 1 : maxIndex + 1;
};

const firstAppleIndex = getNextAppleIndex();

const branches = [
  {
    id: 'competitive-research',
    email: `apple${firstAppleIndex}@apple.com`,
    intentButton: 'Competitive research',
    pathUrl: /\/create\/competitive-research(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-competitive-research',
    continueButtons: ['Go to jobs'],
  },
  {
    id: 'extension-install',
    email: `apple${firstAppleIndex + 1}@apple.com`,
    intentButton: 'Building my team',
    pathUrl: /\/create\/extension-install(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-extension-install',
    continueButtons: ['Go to jobs'],
  },
  {
    id: 'deal-diligence',
    email: `apple${firstAppleIndex + 2}@apple.com`,
    intentButton: 'Investment / deal diligence',
    pathUrl: /\/create\/deal-diligence(?:[/?#]|$)/,
    pathTestId: 'onboarding-path-deal-diligence',
    continueButtons: ['Go to jobs'],
  },
];

const selectedBranches = process.env.ONLY_BRANCH
  ? branches.filter((branch) => branch.id === process.env.ONLY_BRANCH)
  : branches;

const maybeClick = async (locator) => {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }

  return false;
};

const clickAnyVisibleButton = async (page, names) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (const name of names) {
      const button = page.getByRole('button', { name });

      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 30_000 });
        return;
      }
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error(`No visible button found for: ${names.join(', ')}`);
};

const signUpAndReachIntentChoice = async (page, email, runId) => {
  const workspaceName = `Apple ${runId}`;

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
  await page.locator('input[placeholder="Tim"]').first().fill('Apple');
  await page.locator('input[placeholder="Cook"]').first().fill(runId);
  await page.getByRole('button', { name: 'Continue' }).click();

  try {
    await page.getByText('Add your phone number').waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Skip' }).click();
  } catch {
    await page.waitForURL(/\/create\/intent(?:[/?#]|$)/, {
      timeout: 120_000,
    });
  }

  await page.waitForURL(/\/create\/intent(?:[/?#]|$)/, {
    timeout: 120_000,
  });
  await page.getByTestId('onboarding-intent-choice').waitFor({
    timeout: 120_000,
  });
};

const verifyBranch = async (browser, branch) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await signUpAndReachIntentChoice(page, branch.email, branch.id);

    await page.getByRole('button', { name: branch.intentButton }).click();
    await page.waitForURL(branch.pathUrl, { timeout: 120_000 });
    await page.getByTestId(branch.pathTestId).waitFor({ timeout: 120_000 });

    await clickAnyVisibleButton(page, branch.continueButtons);
    await page.waitForURL(/http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/, {
      timeout: 120_000,
    });

    return {
      branch: branch.id,
      email: branch.email,
      success: true,
      finalUrl: page.url(),
    };
  } catch (error) {
    return {
      branch: branch.id,
      email: branch.email,
      success: false,
      finalUrl: page.url(),
      error: error instanceof Error ? error.stack || error.message : String(error),
    };
  } finally {
    await context.close();
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    console.log(
      JSON.stringify({
        baseUrl: BASE_URL,
        emails: selectedBranches.map((branch) => branch.email),
      }),
    );

    for (const branch of selectedBranches) {
      const result = await verifyBranch(browser, branch);
      results.push(result);
      console.log(JSON.stringify(result));
    }
  } finally {
    await browser.close();
  }

  if (results.some((result) => !result.success)) {
    process.exitCode = 1;
  }
})();
