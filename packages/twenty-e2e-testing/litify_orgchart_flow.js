const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const BASE_URL = process.env.FRONTEND_BASE_URL || 'http://cool-raccoon.localhost:3001';
const COMPANY = process.env.E2E_TEST_COMPANY || 'Litify';
const AUTH_FILE = '/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-e2e-testing/.auth/user.json';
const OUT_DIR = '/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-e2e-testing/run_results';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page = await context.newPage();

  const network = {
    pythonQueryGenerator: [],
    linkedinSearchApi: [],
    orgchartBuild: [],
    jobsCreated: [],
    graphqlMutations: [],
  };

  page.on('request', async (req) => {
    try {
      const url = req.url();
      const method = req.method();
      const body = req.postData();
      const entry = { method, url, body };
      if (url.includes('/api/query-generator/linkedin')) network.pythonQueryGenerator.push(entry);
      if (/linkedin/i.test(url) && !url.includes('/api/query-generator/linkedin')) network.linkedinSearchApi.push(entry);
      if (url.includes('/api/orgchart/build') || url.includes('/org-chart/')) network.orgchartBuild.push(entry);
      if (url.includes('/jobs') && method === 'POST') network.jobsCreated.push(entry);
      if (url.includes('/graphql') && body && /mutation/i.test(body)) network.graphqlMutations.push(entry);
    } catch {}
  });

  const shot = async (name) => {
    const p = path.join(OUT_DIR, name);
    await page.screenshot({ path: p, fullPage: true });
    console.log('screenshot', p);
  };

  const clickIfVisible = async (locator) => {
    if (await locator.first().isVisible().catch(() => false)) {
      await locator.first().click();
      return true;
    }
    return false;
  };

  try {
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Dismiss common modal overlays if present
    await clickIfVisible(page.getByRole('button', { name: /close|skip|not now|later/i }));

    const companySearchInput = page.getByPlaceholder("Search any company's org chart...");
    await companySearchInput.waitFor({ state: 'visible', timeout: 120000 });
    await companySearchInput.click();
    await companySearchInput.fill(COMPANY);

    const companyOption = page.getByRole('option', { name: new RegExp(COMPANY, 'i') }).first();
    await companyOption.waitFor({ state: 'visible', timeout: 60000 });
    await companyOption.click();

    await shot('litify-01-preview-render-load.png');

    const diagramOrLoading = page.locator('.orgchart-diagram, [style*="Loading org chart"], [style*="loading"]');
    await diagramOrLoading.first().waitFor({ state: 'visible', timeout: 120000 });

    // trigger full company render from template if needed
    const allButton = page.getByRole('button', { name: /^All$/i }).first();
    if (await allButton.isVisible().catch(() => false)) {
      await allButton.click();
    }

    await page.waitForSelector('.orgchart-diagram canvas', { state: 'visible', timeout: 240000 });
    await page.waitForTimeout(5000);
    await shot('litify-02-full-orgchart-load.png');

    // Leadership
    const leadersButton = page.getByRole('button', { name: /leaders/i }).first();
    if (await leadersButton.isVisible().catch(() => false)) {
      await leadersButton.click();
      await page.waitForTimeout(4000);
      await shot('litify-03-leadership-load.png');
    }

    // Function + Location selectors (best-effort matching)
    const selects = page.locator('select');
    const count = await selects.count();
    let locationSelect = null;
    let functionSelect = null;

    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      const opts = (await sel.locator('option').allTextContents().catch(() => [])).map((x) => x.trim());
      if (!opts.length) continue;
      if (opts.some((o) => /united states/i.test(o)) && !locationSelect) locationSelect = sel;
      if ((opts.some((o) => /technology/i.test(o)) || opts.some((o) => /^hr$|human resources/i.test(o))) && !functionSelect) functionSelect = sel;
    }

    if (functionSelect) {
      const opts = (await functionSelect.locator('option').allTextContents()).map((x) => x.trim());
      const tech = opts.find((o) => /technology/i.test(o));
      if (tech) {
        await functionSelect.selectOption({ label: tech });
        await page.waitForTimeout(4000);
        await shot('litify-04-technology-function-load.png');
      }
      const hr = opts.find((o) => /^hr$/i.test(o) || /human resources/i.test(o));
      if (hr) {
        await functionSelect.selectOption({ label: hr });
        await page.waitForTimeout(4000);
        await shot('litify-05-hr-function-load.png');
      }
    }

    if (locationSelect) {
      const opts = (await locationSelect.locator('option').allTextContents()).map((x) => x.trim());
      const global = opts.find((o) => /^all$/i.test(o) || /^global$/i.test(o));
      if (global) {
        await locationSelect.selectOption({ label: global });
        await page.waitForTimeout(4000);
        await shot('litify-06-location-global-load.png');
      }
      const us = opts.find((o) => /united states/i.test(o));
      if (us) {
        await locationSelect.selectOption({ label: us });
        await page.waitForTimeout(4000);
        await shot('litify-07-location-united-states-load.png');
      }
    }

    // Try HR leadership node right-click -> fetch people in this node
    let nodeTarget = page.locator('.orgchart-diagram [data-key]:has-text("HR")').first();
    if (!(await nodeTarget.isVisible().catch(() => false))) {
      nodeTarget = page.locator('.orgchart-diagram [data-key]').first();
    }

    if (await nodeTarget.isVisible().catch(() => false)) {
      await nodeTarget.click({ button: 'right' });
      await page.waitForTimeout(1000);
      const fetchInNode = page.getByText(/fetch people in this node/i).first();
      if (await fetchInNode.isVisible().catch(() => false)) {
        await fetchInNode.click();
        await page.waitForTimeout(3000);
        await shot('litify-08-node-fetch-preview-render.png');

        // Wait for some result container/list to appear
        const resultSignals = page.locator('[role="dialog"], .modal, [data-testid*="candidate"], [data-testid*="result"], .orgchart-diagram');
        await resultSignals.first().waitFor({ state: 'visible', timeout: 120000 }).catch(() => {});
        await page.waitForTimeout(4000);
        await shot('litify-09-node-fetch-full-render.png');
      }
    }

    // Final state shot
    await shot('litify-10-final-state.png');

    const summary = {
      company: COMPANY,
      baseUrl: BASE_URL,
      screenshotDir: OUT_DIR,
      counts: {
        pythonQueryGenerator: network.pythonQueryGenerator.length,
        linkedinSearchApi: network.linkedinSearchApi.length,
        orgchartBuild: network.orgchartBuild.length,
        jobsCreated: network.jobsCreated.length,
        graphqlMutations: network.graphqlMutations.length,
      },
      samples: {
        pythonQueryGenerator: network.pythonQueryGenerator.slice(-5),
        linkedinSearchApi: network.linkedinSearchApi.slice(-10),
        orgchartBuild: network.orgchartBuild.slice(-10),
        jobsCreated: network.jobsCreated.slice(-10),
        graphqlMutations: network.graphqlMutations.slice(-10),
      },
    };

    const summaryPath = path.join(OUT_DIR, 'litify-orgchart-network-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('summary', summaryPath);
    console.log(JSON.stringify(summary.counts, null, 2));
  } catch (e) {
    console.error('FLOW_ERR', e?.stack || e?.message || e);
    await shot('litify-error-state.png').catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
