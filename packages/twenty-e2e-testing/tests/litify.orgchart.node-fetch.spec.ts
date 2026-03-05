import { expect, test } from '@playwright/test';

test.describe('Litify org chart node fetch (canvas)', () => {
  test.use({
    storageState: '.auth/user.json',
  });

  test('right-click canvas node and fetch people in this node', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);

    const runResults: string[] = [];
    const network = {
      linkedinSearchApi: [] as string[],
      orgchartApi: [] as string[],
      pythonQueryGenerator: [] as string[],
      jobsCreate: [] as string[],
    };

    // Keep test on org-chart page (avoid redirect loops).
    await page.route('**/linkedin-unipile/accounts', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'connected',
            result: [{ provider: 'linkedin', connected: true }],
          }),
        });
      }
      return route.continue();
    });
    await page.route('**/linkedin-unipile/org-chart/ensure-account', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'connected', success: true, redirect_url: null }),
        });
      }
      return route.continue();
    });

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/query-generator/linkedin')) network.pythonQueryGenerator.push(url);
      if (/linkedin-unipile|linkedin/i.test(url) && !url.includes('/api/query-generator/linkedin')) {
        network.linkedinSearchApi.push(url);
      }
      if (url.includes('/org-chart/')) network.orgchartApi.push(url);
      if (url.includes('/jobs') && req.method() === 'POST') network.jobsCreate.push(url);
    });

    await page.goto('/org-chart/litify', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForSelector('.orgchart-diagram canvas', {
      state: 'visible',
      timeout: 180_000,
    });
    await page.waitForTimeout(4_000);

    // Normalize to full-company + global for consistent node layout.
    const countrySelect = page.locator('select').nth(0);
    const functionSelect = page.locator('select').nth(1);

    const functionOptions = (await functionSelect.locator('option').allTextContents()).map((o) =>
      o.trim(),
    );
    const fullCompany = functionOptions.find((o) => /^full company/i.test(o));
    if (fullCompany) {
      await functionSelect.selectOption({ label: fullCompany });
    }

    const countryOptions = (await countrySelect.locator('option').allTextContents()).map((o) =>
      o.trim(),
    );
    const global = countryOptions.find((o) => /^global/i.test(o));
    if (global) {
      await countrySelect.selectOption({ label: global });
    }

    await page.waitForTimeout(4_000);

    const closeModal = page.getByRole('button', { name: /close/i }).first();
    if (await closeModal.isVisible().catch(() => false)) {
      await closeModal.click();
      await page.waitForTimeout(600);
    }

    await page.screenshot({
      path: 'run_results/litify-nodefetch-01-fullcompany-global.png',
      fullPage: true,
    });
    runResults.push('run_results/litify-nodefetch-01-fullcompany-global.png');

    const canvas = page.locator('.orgchart-diagram canvas').first();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // Optional interactive pause for headed runs.
    // Use PAUSE_BEFORE_NODE_FETCH=1 to inspect canvas and manually pick HR node coordinates.
    if (process.env.PAUSE_BEFORE_NODE_FETCH === '1') {
      // eslint-disable-next-line no-console
      console.log('Paused before node fetch scan. Use HR_NODE_X/HR_NODE_Y env to target a specific canvas coordinate.');
      await page.pause();
    }

    // Candidate points biased toward top/middle bands where leadership nodes usually render.
    const xRatios = [0.18, 0.28, 0.36, 0.46, 0.56, 0.66, 0.76];
    const yRatios = [0.20, 0.28, 0.36, 0.44, 0.52];
    const points: Array<{ x: number; y: number }> = [];
    for (const yr of yRatios) {
      for (const xr of xRatios) {
        points.push({
          x: Math.round(box.x + box.width * xr),
          y: Math.round(box.y + box.height * yr),
        });
      }
    }

    const fetchInNodeLocator = page.getByText(/fetch people in this node/i).first();
    let fetched = false;

    // Optional direct target click when you know the HR leadership node coordinate.
    const envX = process.env.HR_NODE_X ? Number(process.env.HR_NODE_X) : NaN;
    const envY = process.env.HR_NODE_Y ? Number(process.env.HR_NODE_Y) : NaN;
    if (Number.isFinite(envX) && Number.isFinite(envY)) {
      await page.mouse.click(envX, envY, { button: 'right' });
      await page.waitForTimeout(400);
      if (await fetchInNodeLocator.isVisible().catch(() => false)) {
        await page.screenshot({
          path: 'run_results/litify-nodefetch-02-context-found-env-coords.png',
          fullPage: true,
        });
        runResults.push('run_results/litify-nodefetch-02-context-found-env-coords.png');
        await fetchInNodeLocator.click();
        await page.waitForTimeout(3_000);
        await page.screenshot({
          path: 'run_results/litify-nodefetch-03-fetch-preview.png',
          fullPage: true,
        });
        runResults.push('run_results/litify-nodefetch-03-fetch-preview.png');
        await page.waitForTimeout(6_000);
        await page.screenshot({
          path: 'run_results/litify-nodefetch-04-fetch-full.png',
          fullPage: true,
        });
        runResults.push('run_results/litify-nodefetch-04-fetch-full.png');
        fetched = true;
      }
    }

    if (fetched) {
      await page.screenshot({
        path: 'run_results/litify-nodefetch-05-final.png',
        fullPage: true,
      });
      runResults.push('run_results/litify-nodefetch-05-final.png');
      console.log(
        JSON.stringify(
          {
            fetched,
            screenshots: runResults,
            networkCounts: {
              orgchartApi: network.orgchartApi.length,
              linkedinSearchApi: network.linkedinSearchApi.length,
              pythonQueryGenerator: network.pythonQueryGenerator.length,
              jobsCreate: network.jobsCreate.length,
            },
            lastOrgchartApi: network.orgchartApi.slice(-10),
            lastLinkedinApi: network.linkedinSearchApi.slice(-10),
            lastJobsCreate: network.jobsCreate.slice(-10),
          },
          null,
          2,
        ),
      );
      return;
    }

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await page.waitForTimeout(300);

      if (await fetchInNodeLocator.isVisible().catch(() => false)) {
        await page.screenshot({
          path: `run_results/litify-nodefetch-02-context-found-${i + 1}.png`,
          fullPage: true,
        });
        runResults.push(`run_results/litify-nodefetch-02-context-found-${i + 1}.png`);

        await fetchInNodeLocator.click();
        await page.waitForTimeout(3_000);

        await page.screenshot({
          path: 'run_results/litify-nodefetch-03-fetch-preview.png',
          fullPage: true,
        });
        runResults.push('run_results/litify-nodefetch-03-fetch-preview.png');

        await page.waitForTimeout(6_000);
        await page.screenshot({
          path: 'run_results/litify-nodefetch-04-fetch-full.png',
          fullPage: true,
        });
        runResults.push('run_results/litify-nodefetch-04-fetch-full.png');
        fetched = true;
        break;
      }

      await page.keyboard.press('Escape').catch(() => {});
    }

    await page.screenshot({
      path: 'run_results/litify-nodefetch-05-final.png',
      fullPage: true,
    });
    runResults.push('run_results/litify-nodefetch-05-final.png');

    // Attach diagnostic summary into test output.
    console.log(
      JSON.stringify(
        {
          fetched,
          screenshots: runResults,
          networkCounts: {
            orgchartApi: network.orgchartApi.length,
            linkedinSearchApi: network.linkedinSearchApi.length,
            pythonQueryGenerator: network.pythonQueryGenerator.length,
            jobsCreate: network.jobsCreate.length,
          },
          lastOrgchartApi: network.orgchartApi.slice(-10),
          lastLinkedinApi: network.linkedinSearchApi.slice(-10),
          lastJobsCreate: network.jobsCreate.slice(-10),
        },
        null,
        2,
      ),
    );
  });
});
