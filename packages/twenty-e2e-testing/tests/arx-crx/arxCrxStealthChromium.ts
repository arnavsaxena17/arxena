import { chromium as chromiumFromPlaywright } from '@playwright/test';
import { chromium as chromiumExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { logStage } from './arxCrxLogging';

let stealthPluginApplied = false;

/**
 * When enabled (default), uses `playwright-extra` + `puppeteer-extra-plugin-stealth` for
 * `launchPersistentContext` (LinkedIn / extension E2E). Disable with `E2E_CRX_STEALTH=0`.
 */
export const getExtensionE2EChromium = () => {
  const raw = process.env.E2E_CRX_STEALTH?.trim().toLowerCase();
  const useStealth = !(raw === '0' || raw === 'false' || raw === 'no');

  if (!useStealth) {
    return chromiumFromPlaywright;
  }

  if (!stealthPluginApplied) {
    chromiumExtra.use(StealthPlugin());
    stealthPluginApplied = true;
    logStage('helper:getExtensionE2EChromium: playwright-extra + stealth plugin enabled');
  }

  return chromiumExtra;
};
