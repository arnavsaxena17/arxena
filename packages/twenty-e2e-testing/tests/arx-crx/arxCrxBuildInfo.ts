import { BrowserContext, expect } from '@playwright/test';

import { logStage, logStageFailure } from './arxCrxLogging';

export type ArxCrxBuildConsolePayload = {
  flavor: string;
  base_url: string;
  LOCAL_EXTENSION_ENV: boolean;
  expectBackground: string;
};

/**
 * Reads `ARX_CRX_BUILD_INFO` from the extension MV3 service worker (`backgroundUtils.ts` sets
 * `globalThis.__ARX_CRX_BUILD_INFO__`). Playwright does not expose extension SW `console.log` on `Worker`
 * (only `close`), so E2E asserts the same data as the `[arx-crx] build` log line via evaluate.
 */
export const getArxCrxBuildFromServiceWorker = async (
  context: BrowserContext,
  timeoutMs = 15_000,
): Promise<ArxCrxBuildConsolePayload> => {
  try {
    logStage(
      'helper:getArxCrxBuildFromServiceWorker: resolving service worker',
    );
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      logStage(
        'helper:getArxCrxBuildFromServiceWorker: waiting for serviceworker event',
      );
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    logStage(
      'helper:getArxCrxBuildFromServiceWorker: polling __ARX_CRX_BUILD_INFO__',
      {
        timeoutMs,
      },
    );
    await expect
      .poll(
        async () => {
          const payload = await serviceWorker.evaluate(() => {
            const g = globalThis as unknown as {
              __ARX_CRX_BUILD_INFO__?: ArxCrxBuildConsolePayload | null;
            };
            return g.__ARX_CRX_BUILD_INFO__ ?? null;
          });
          return payload;
        },
        { timeout: timeoutMs },
      )
      .not.toBeNull();

    logStage('helper:getArxCrxBuildFromServiceWorker: reading final payload');
    return await serviceWorker.evaluate(() => {
      const g = globalThis as unknown as {
        __ARX_CRX_BUILD_INFO__?: ArxCrxBuildConsolePayload;
      };
      return g.__ARX_CRX_BUILD_INFO__ as ArxCrxBuildConsolePayload;
    });
  } catch (error) {
    logStageFailure('helper:getArxCrxBuildFromServiceWorker', error, {
      timeoutMs,
    });
    throw error;
  }
};
