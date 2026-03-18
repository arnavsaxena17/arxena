import { expect, type Locator, type Page } from '@playwright/test';

import { LoginPage } from '../../lib/pom/loginPage';

const waitForAppOrWelcome = async (page: Page) => {
  await page
    .waitForURL(/\/(welcome|assistant|jobs)(?:[/?#]|$)/, { timeout: 60_000 })
    .catch(() => {});
};

const ensureAuthenticated = async (page: Page) => {
  const login = process.env.DEFAULT_LOGIN || 'arnav@arxena.com';
  const password = process.env.DEFAULT_PASSWORD || 'Applecar2025';
  console.log('password', password);
  const loginPage = new LoginPage(page);
  const passwordField = page
    .locator(
      'input[placeholder="Password"], input[type="password"], input[name="password"]',
    )
    .first();

  const emailField = page
    .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
    .first();

  const emailFieldVisible = await emailField
    .isVisible()
    .catch(() => false);

  const isOnWelcome = /\/welcome(?:[/?#]|$)/.test(page.url());
  if (!emailFieldVisible && !isOnWelcome) return;

  // If we're on the welcome route, the modal may take a moment to mount.
  await emailField.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  console.log('emailFieldVisible', emailFieldVisible);
  if (await loginPage.hasVisibleLoginWithEmailButton()) {
    await loginPage.clickLoginWithEmail();
  }
  console.log('login', login);
  await loginPage.typeEmail(login);
  await loginPage.clickContinueButton();
  console.log('continueButton clicked');
  // Some environments show a password step; others redirect straight into the app after email.
  await Promise.race([
    passwordField.waitFor({ state: 'visible', timeout: 15_000 }),
    page.waitForURL(/\/(jobs|assistant)(?:[/?#]|$)/, { timeout: 15_000 }),
  ]).catch(() => {});
  const passwordFieldVisible = await passwordField.isVisible().catch(() => false);
  console.log('passwordFieldVisible', passwordFieldVisible);
  if (passwordFieldVisible) {
    await loginPage.typePassword(password);
    await loginPage.submitPasswordStep();
  }
  console.log('password submitted');  
  // After successful login, we should land in the app (often /jobs) on app.localhost.
  await page
    .waitForURL(/\/(jobs|assistant)(?:[/?#]|$)/, { timeout: 60_000 })
    .catch(() => {});
  console.log('page.url()', page.url());
};

export const goToAssistantPage = async (page: Page) => {
  // Start from localhost; the app will redirect to app.localhost and /welcome when auth is needed.
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  console.log('goto /');
  await waitForAppOrWelcome(page);
  console.log('waitForAppOrWelcome');

  const goToAssistantOnCurrentOrigin = async () => {
    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/assistant`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
  };

  // Always navigate to /assistant after any redirects.
  await goToAssistantOnCurrentOrigin();
  console.log('goto /assistant');
  await waitForAppOrWelcome(page);

  const threadsSidebar = getAssistantThreadsSidebar(page);
  const emailField = page
    .locator('input[placeholder="Email"], input[type="email"], input[name="email"]')
    .first();

  // Wait until either the assistant UI is visible or we see the login modal.
  await Promise.race([
    threadsSidebar.getByText('Threads').waitFor({ state: 'visible', timeout: 15_000 }),
    emailField.waitFor({ state: 'visible', timeout: 15_000 }),
  ]).catch(() => {});

  await ensureAuthenticated(page);

  // After login we may be on /welcome or /jobs; ensure we end up on /assistant.
  if (!/\/assistant(?:[/?#]|$)/.test(page.url())) {
    await goToAssistantOnCurrentOrigin();
    await waitForAppOrWelcome(page);
  }

  await page.waitForURL(/\/assistant(?:[/?#]|$)/, { timeout: 60_000 });
};

export const getAssistantThreadsSidebar = (page: Page) => {
  return page.locator('aside', { hasText: 'Threads' });
};

export const getSidebarThreadButtons = (sidebar: Locator) => {
  const newThreadAction = sidebar
    .getByRole('button', { name: /new thread/i })
    .first();

  return sidebar.locator('button').filter({ hasNot: newThreadAction });
};

export const readSidebarThreadNames = async (threadButtons: Locator) => {
  const count = await threadButtons.count();
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = (await threadButtons.nth(i).innerText()).trim();
    // Thread button contains title + preview; keep the first non-empty line as the name.
    const name = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    if (name) names.push(name);
  }

  return names;
};

export const expectThreadsLoaded = async (sidebar: Locator) => {
  await expect(sidebar.getByText('Threads')).toBeVisible({ timeout: 60_000 });
};

