#!/usr/bin/env node
/**
 * Verifies that a LinkedIn `li_at` cookie is enough for Playwright to load LinkedIn as logged in.
 *
 * Usage (from repo root or this package):
 *   LINKEDIN_LI_AT='your_cookie_value' node packages/twenty-e2e-testing/scripts/check-linkedin-li-at.mjs
 *
 * Or add LINKEDIN_LI_AT to packages/twenty-e2e-testing/.env (gitignored) and run the same command without the prefix.
 *
 * Optional: LINKEDIN_EXPECTED_SESSION_NAME="First Last" — after load, asserts page body text
 * contains each name part (case-insensitive). LinkedIn may delay rendering; we wait briefly.
 *
 * Exit 0 if the feed loads without being redirected to /login; exit 1 otherwise.
 */

import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, '../.env') });

const LI_AT = (process.env.LINKEDIN_LI_AT || '').trim();
const EXPECTED_SESSION_NAME = (
  process.env.LINKEDIN_EXPECTED_SESSION_NAME || ''
).trim();
const FEED_URL = 'https://www.linkedin.com/feed/';

async function main() {
  if (!LI_AT) {
    console.error(
      'Missing LINKEDIN_LI_AT. Set it in the environment or in packages/twenty-e2e-testing/.env',
    );
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
  });

  const context = await browser.newContext();

  await context.addCookies([
    {
      name: 'li_at',
      value: LI_AT,
      domain: '.linkedin.com',
      path: '/',
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  let finalUrl = '';
  try {
    await page.goto(FEED_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    finalUrl = page.url();
  } catch (e) {
    console.error('Navigation failed:', (e && e.message) || e);
    await browser.close();
    process.exit(1);
  }

  const onLoginPage =
    finalUrl.includes('/login') ||
    finalUrl.includes('/checkpoint') ||
    finalUrl.includes('/uas/login');

  const title = await page.title().catch(() => '');

  console.log('Final URL:', finalUrl);
  console.log('Page title:', title);

  if (onLoginPage) {
    console.error(
      'Session check failed: still on login/checkpoint. Cookie may be expired, invalid, or LinkedIn requires more cookies.',
    );
    await browser.close();
    process.exit(1);
  }

  console.log('OK: li_at appears to establish a logged-in session for Playwright.');

  if (EXPECTED_SESSION_NAME) {
    await page.waitForTimeout(4_000);
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const normalized = bodyText.toLowerCase();
    const parts = EXPECTED_SESSION_NAME.toLowerCase().split(/\s+/).filter(Boolean);
    const missing = parts.filter((p) => !normalized.includes(p));
    if (missing.length > 0) {
      console.error(
        `Session name check failed: expected body to include name parts [${parts.join(', ')}]; missing: [${missing.join(', ')}].`,
      );
      await browser.close();
      process.exit(1);
    }
    console.log(
      `OK: feed page text includes expected session name parts for "${EXPECTED_SESSION_NAME}".`,
    );
  }

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
