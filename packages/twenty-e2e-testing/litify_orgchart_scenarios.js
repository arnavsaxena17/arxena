const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const BASE_URL = process.env.FRONTEND_BASE_URL || 'http://cool-raccoon.localhost:3001';
const AUTH_FILE = '/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-e2e-testing/.auth/user.json';
const OUT_DIR = '/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-e2e-testing/run_results';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page = await context.newPage();

  // Prevent external redirect flows from blocking org-chart scenario automation.
  await page.route('**/linkedin-unipile/accounts', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'connected', result: [{ provider: 'linkedin', connected: true }] }),
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

  const network = {
    pythonQueryGenerator: [],
    linkedinSearchApi: [],
    orgchartApi: [],
    jobsCreate: [],
    graphqlMutations: [],
  };

  const pushReq = (bucket, req, extra = {}) => {
    bucket.push({
      t: new Date().toISOString(),
      method: req.method(),
      url: req.url(),
      postData: req.postData() || null,
      ...extra,
    });
  };

  page.on('response', async (res) => {
    try {
      const req = res.request();
      const url = req.url();
      const status = res.status();
      const common = { status };

      if (url.includes('/api/query-generator/linkedin')) pushReq(network.pythonQueryGenerator, req, common);
      if (/linkedin-unipile|linkedin/i.test(url) && !url.includes('/api/query-generator/linkedin')) pushReq(network.linkedinSearchApi, req, common);
      if (url.includes('/org-chart/')) pushReq(network.orgchartApi, req, common);
      if (url.includes('/jobs') && req.method() === 'POST') pushReq(network.jobsCreate, req, common);
      if (url.includes('/graphql') && req.method() === 'POST' && /mutation/i.test(req.postData() || '')) pushReq(network.graphqlMutations, req, common);
    } catch {}
  });

  const shot = async (name) => {
    const p = path.join(OUT_DIR, name);
    await page.screenshot({ path: p, fullPage: true });
    console.log('screenshot', p);
  };

  const waitRender = async () => {
    await page.waitForSelector('.orgchart-diagram', { state: 'visible', timeout: 120000 });
    await page.waitForSelector('.orgchart-diagram canvas', { state: 'visible', timeout: 180000 });
    await page.waitForTimeout(3000);
  };

  const selectByContains = async (selectLocator, pattern) => {
    const opts = (await selectLocator.locator('option').allTextContents()).map((x) => x.trim());
    const label = opts.find((o) => pattern.test(o));
    if (!label) return null;
    await selectLocator.selectOption({ label });
    await page.waitForTimeout(3500);
    return label;
  };

  try {
    await page.goto(`${BASE_URL}/org-chart/litify`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    await page.waitForSelector('.orgchart-diagram', { state: 'visible', timeout: 120000 });
    await shot('litify-11-preview-render-load.png');

    await waitRender();
    await shot('litify-12-full-orgchart-load.png');

    const functionSelect = page.locator('select').nth(1);
    const countrySelect = page.locator('select').nth(0);

    await selectByContains(functionSelect, /^full company/i);
    await waitRender();
    await shot('litify-13-fullcompany-selected.png');

    const leadersBtn = page.getByRole('button', { name: /leaders/i }).first();
    if (await leadersBtn.isVisible().catch(() => false)) {
      await leadersBtn.click();
      await page.waitForTimeout(3500);
      await shot('litify-14-leadership-load.png');
    }

    await selectByContains(functionSelect, /^technology\b/i);
    await waitRender();
    await shot('litify-15-technology-function-load.png');

    await selectByContains(functionSelect, /^human resources\b/i);
    await waitRender();
    await shot('litify-16-hr-function-load.png');

    await selectByContains(countrySelect, /^global/i);
    await waitRender();
    await shot('litify-17-location-global-load.png');

    await selectByContains(countrySelect, /^united states/i);
    await waitRender();
    await shot('litify-18-location-united-states-load.png');

    // HR leadership node interaction
    await selectByContains(countrySelect, /^global/i);
    await selectByContains(functionSelect, /^full company/i);
    await waitRender();

    const hrLeadershipText = page.getByText(/human resources leadership/i).first();
    if (await hrLeadershipText.isVisible().catch(() => false)) {
      await hrLeadershipText.click({ button: 'right' });
      await page.waitForTimeout(1200);
      const fetchNode = page.getByText(/fetch people in this node/i).first();
      if (await fetchNode.isVisible().catch(() => false)) {
        await fetchNode.click();
        await page.waitForTimeout(3000);
        await shot('litify-19-node-fetch-preview-render.png');
        await page.waitForTimeout(5000);
        await shot('litify-20-node-fetch-full-render.png');
      } else {
        await shot('litify-19-node-context-menu-missing.png');
      }
    } else {
      await shot('litify-19-hr-leadership-node-not-found.png');
    }

    const summary = {
      scenario: 'litify-orgchart-scenarios',
      counts: {
        pythonQueryGenerator: network.pythonQueryGenerator.length,
        linkedinSearchApi: network.linkedinSearchApi.length,
        orgchartApi: network.orgchartApi.length,
        jobsCreate: network.jobsCreate.length,
        graphqlMutations: network.graphqlMutations.length,
      },
      samples: {
        pythonQueryGenerator: network.pythonQueryGenerator.slice(-40),
        linkedinSearchApi: network.linkedinSearchApi.slice(-60),
        orgchartApi: network.orgchartApi.slice(-60),
        jobsCreate: network.jobsCreate.slice(-40),
        graphqlMutations: network.graphqlMutations.slice(-40),
      },
    };

    const summaryPath = path.join(OUT_DIR, 'litify-orgchart-scenarios-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('summary', summaryPath);
    console.log(JSON.stringify(summary.counts, null, 2));
  } catch (e) {
    console.error('FLOW_ERR', e?.stack || e?.message || e);
    await shot('litify-scenarios-error.png').catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
