import { BrowserContext, expect, Page } from '@playwright/test';

import { logStage, logStageFailure } from './arxCrxLogging';

/** Same as `scripts/check-linkedin-li-at.mjs` feed URL. */
export const LINKEDIN_FEED_URL = 'https://www.linkedin.com/feed/';

/**
 * `LINKEDIN_LI_AT` from env (Playwright loads `packages/twenty-e2e-testing/.env`).
 * When unset/empty, LinkedIn + Unipile assertions are skipped.
 */
export const getLinkedInLiAtFromEnv = (): string => {
  return (process.env.LINKEDIN_LI_AT || '').trim();
};

/** Optional: `LINKEDIN_EXPECTED_SESSION_NAME` — space-separated name parts must appear in feed body. */
export const getLinkedInExpectedSessionNameFromEnv = (): string => {
  return (process.env.LINKEDIN_EXPECTED_SESSION_NAME || '').trim();
};

/**
 * Navigate to LinkedIn feed with existing `li_at` in context and assert session is not login/checkpoint.
 * Mirrors `scripts/check-linkedin-li-at.mjs`.
 */
export const assertLinkedInFeedSessionWithLiAt = async (
  page: Page,
  options: { expectedSessionName?: string } = {},
) => {
  try {
    logStage('helper:assertLinkedInFeedSessionWithLiAt: goto feed');
    await page.goto(LINKEDIN_FEED_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    const finalUrl = page.url();
    const onLoginPage =
      finalUrl.includes('/login') ||
      finalUrl.includes('/checkpoint') ||
      finalUrl.includes('/uas/login');
    logStage('helper:assertLinkedInFeedSessionWithLiAt: landed', {
      finalUrl,
      onLoginPage,
    });
    expect(onLoginPage).toBe(false);

    const expectedSessionName = options.expectedSessionName?.trim();
    if (expectedSessionName) {
      await page.waitForTimeout(4_000);
      const bodyText = await page.evaluate(
        () => document.body?.innerText ?? '',
      );
      const normalized = bodyText.toLowerCase();
      const parts = expectedSessionName
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const missing = parts.filter((p) => !normalized.includes(p));
      logStage('helper:assertLinkedInFeedSessionWithLiAt: name check', {
        expectedSessionName,
        missing,
      });
      expect(missing.length).toBe(0);
    }
    logStage('helper:assertLinkedInFeedSessionWithLiAt: ok');
  } catch (error) {
    logStageFailure('helper:assertLinkedInFeedSessionWithLiAt', error);
    throw error;
  }
};

/** LinkedIn session cookie (same shape as scripts/check-linkedin-li-at.mjs). */
export const addLinkedInLiAtCookie = async (
  context: BrowserContext,
  liAt: string,
) => {
  try {
    logStage('helper:addLinkedInLiAtCookie: adding li_at cookie');
    await context.addCookies([
      {
        name: 'li_at',
        value: liAt,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        sameSite: 'Lax' as const,
      },
    ]);
    logStage('helper:addLinkedInLiAtCookie: done');
  } catch (error) {
    logStageFailure('helper:addLinkedInLiAtCookie', error);
    throw error;
  }
};

export const getLinkedinStatusPill = (popupPage: Page) => {
  return popupPage.locator('#linkedin_status .popup-connection-pill-text');
};

export const dismissLinkedinCookieConsentIfPresent = async (
  popupPage: Page,
) => {
  try {
    const consent = popupPage.locator('#linkedin_cookie_sync_consent');
    if (await consent.isVisible().catch(() => false)) {
      logStage(
        'helper:dismissLinkedinCookieConsentIfPresent: dismissing header consent',
      );
      await popupPage
        .locator('#linkedin_cookie_sync_checkbox')
        .check({ force: true })
        .catch(() => {});
      await popupPage
        .locator('#linkedin_cookie_sync_allow')
        .click({ timeout: 5_000 })
        .catch(() => {});
    }

    const mainCheckbox = popupPage.locator('#linkedin_cookie_sync_checkbox_main');
    if (await mainCheckbox.isVisible().catch(() => false)) {
      logStage(
        'helper:dismissLinkedinCookieConsentIfPresent: dismissing main-content consent (reload)',
      );
      await mainCheckbox.check({ force: true });
      await popupPage.locator('#linkedin_cookie_sync_allow_main').click();
      await popupPage.waitForLoadState('domcontentloaded');
    }
  } catch (error) {
    logStageFailure('helper:dismissLinkedinCookieConsentIfPresent', error);
    throw error;
  }
};

/**
 * Observes `#linkedin_status` pill until Unipile shows **Connected**, and asserts we saw the
 * disconnected → connecting → connected lifecycle (see `arx-crx/index.html` + `popupCommon.ts`).
 */
export const waitForLinkedinUnipilePillLifecycle = async (
  popupPage: Page,
  options: { timeoutMs?: number } = {},
) => {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pill = getLinkedinStatusPill(popupPage);
  const sequence: string[] = [];
  let last = '';
  const start = Date.now();

  try {
    logStage('helper:waitForLinkedinUnipilePillLifecycle: polling');
    while (Date.now() - start < timeoutMs) {
      const t = (await pill.textContent().catch(() => ''))?.trim() ?? '';
      if (t && t !== last) {
        sequence.push(t);
        logStage('helper:waitForLinkedinUnipilePillLifecycle: tick', {
          text: t,
          sequence,
        });
        last = t;
      }
      if (t === 'Connected') {
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    await expect(pill).toHaveText('Connected', { timeout: 5_000 });

    const iOk = sequence.indexOf('Connected');
    const lastConnectingBeforeConnected =
      iOk >= 0 ? sequence.lastIndexOf('Connecting...', iOk) : -1;
    const iDisc = sequence.indexOf('Disconnected');

    logStage('helper:waitForLinkedinUnipilePillLifecycle: final sequence', {
      sequence,
      iDisc,
      lastConnectingBeforeConnected,
      iOk,
    });

    expect(sequence.includes('Connected')).toBe(true);
    expect(lastConnectingBeforeConnected).toBeGreaterThanOrEqual(0);
    expect(iOk).toBeGreaterThan(lastConnectingBeforeConnected);

    if (sequence.includes('Disconnected')) {
      expect(lastConnectingBeforeConnected).toBeGreaterThan(iDisc);
    }

    logStage('helper:waitForLinkedinUnipilePillLifecycle: ok');
  } catch (error) {
    logStageFailure('helper:waitForLinkedinUnipilePillLifecycle', error);
    throw error;
  }
};
