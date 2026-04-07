import { test as base, expect } from '@playwright/test';
import path from 'path';
import { LoginPage } from '../lib/pom/loginPage';
import { signInWithExistingCredentials } from '../lib/utils/authFlowE2eHelpers';

const loginEmail =
  process.env.ARXENA_E2E_EMAIL ||
  'testing@arxena.com';
const loginPassword = process.env.ARXENA_E2E_PASSWORD || process.env.DEFAULT_PASSWORD || 'Applecar2025';
const loginBaseUrl =
  loginEmail.toLowerCase() === 'testing@arxena.com'
    ? 'http://testing-arxena.localhost:3001'
    : (process.env.ARXENA_E2E_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      'http://localhost:3001');

// fixture
const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
});

test('Login test', async ({ loginPage, page }) => {
  test.setTimeout(120_000);

  await test.step('Navigated to login page', async () => {
    await page.goto(loginBaseUrl, { waitUntil: 'domcontentloaded' });
  });
  await test.step(
    'Logging in '.concat(page.url(), ' as ', loginEmail),
    async () => {
      await signInWithExistingCredentials(page, {
        baseUrl: loginBaseUrl,
        email: loginEmail,
        password: loginPassword,
        targetPath: '/jobs',
      });
      await page.waitForURL(/\/jobs(?:[/?#]|$)/);
      await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
      await expect(page.getByText(/Welcome to .+/)).not.toBeVisible();
    },
  );

  await test.step('Saved auth state', async () => {
    await page.context().storageState({
      path: path.resolve(__dirname, '..', '.auth', 'user.json'),
    });
    process.env.LINK = page.url();
  });
});
