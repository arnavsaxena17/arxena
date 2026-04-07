const { chromium } = require('playwright');
const fs = require('fs');

const appBaseUrl = 'http://testing-arxena.localhost:3001';
const apiBaseUrl = 'http://localhost:3000';
const jobId = 'd485761d-0c59-4caf-9c35-37a8391234d8';
const targetPhone = '918411937769';
const storageStatePath = '/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-e2e-testing/.auth/user.json';

function extractAccessToken(storageState) {
  const cookie = storageState.cookies.find((c) => c.name === 'tokenPair');
  if (!cookie) throw new Error('tokenPair cookie missing in storage state');
  return JSON.parse(decodeURIComponent(cookie.value)).accessToken.token;
}

async function getCandidates(authToken) {
  const res = await fetch(apiBaseUrl + '/candidate-sourcing/get-candidates-by-job-id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + authToken,
    },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) throw new Error('candidate fetch failed: ' + res.status);
  return res.json();
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function findCandidate(candidates) {
  return candidates.find((candidate) => normalizeDigits(candidate?.phoneNumber?.primaryPhoneNumber).endsWith(targetPhone.slice(-10)));
}

function getMessages(candidate) {
  return (candidate?.whatsappMessages?.edges || []).map((edge) => edge?.node).filter(Boolean);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
  const authToken = extractAccessToken(storageState);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  try {
    await page.goto(appBaseUrl + '/job/' + jobId, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForURL(new RegExp('/job/' + jobId + '(?:[/?#]|$)'), { timeout: 90000 });

    await page.waitForFunction(() => {
      const search = document.querySelector('input[placeholder*="Search candidates"]');
      const importBtn = Array.from(document.querySelectorAll('button')).some((button) => /import candidates/i.test(button.textContent || ''));
      return Boolean(search || importBtn || document.body.innerText.includes('No candidates found'));
    }, { timeout: 90000 });

    const firstRow = page.locator('.htCore tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 30000 });
    const firstRowText = ((await firstRow.textContent()) || '').replace(/\s+/g, ' ').trim();

    console.log('JOB_URL=' + page.url());
    console.log('FIRST_ROW_VISIBLE=true');
    console.log('FIRST_ROW_TEXT=' + firstRowText);
    console.log('FIRST_ROW_HAS_PHONE=' + String(firstRowText.includes(targetPhone)));

    let candidates = await getCandidates(authToken);
    let candidate = findCandidate(candidates);
    if (!candidate) throw new Error('Candidate ' + targetPhone + ' not found in API');
    console.log('CANDIDATE_FOUND_API=true');
    console.log('CANDIDATE_ID=' + candidate.id);
    console.log('MESSAGES_BEFORE_RESET=' + getMessages(candidate).length);

    const checkbox = page.locator('.row-checkbox').first();
    await checkbox.setChecked(true, { force: true });

    await page.getByRole('button', { name: /all actions/i }).first().click();
    await page.getByRole('menuitem', { name: /reset messages from whatsapp/i }).first().click();
    await page.getByRole('button', { name: /reset messages from whatsapp/i }).last().click();

    const resetStart = Date.now();
    while (Date.now() - resetStart < 30000) {
      candidates = await getCandidates(authToken);
      candidate = findCandidate(candidates);
      if (candidate && getMessages(candidate).length === 0) break;
      await sleep(1000);
    }
    console.log('MESSAGES_AFTER_RESET=' + getMessages(candidate).length);

    await checkbox.setChecked(true, { force: true });
    await page.getByRole('button', { name: /all actions/i }).first().click();
    await page.getByRole('menuitem', { name: /start chat with candidates/i }).first().click();
    await page.getByRole('button', { name: /^start chat$/i }).last().click();

    const startChatClickedAt = Date.now();
    let introFound = false;
    let introMessage = null;
    let seenCount = -1;
    let introLatencyMs = -1;
    while (Date.now() - startChatClickedAt < 20000) {
      candidates = await getCandidates(authToken);
      candidate = findCandidate(candidates);
      const messages = getMessages(candidate);
      seenCount = messages.length;
      introMessage = messages.find((message) => String(message.message || '').includes('Recruiter at Testing Arxena')) || null;
      if (introMessage) {
        introFound = true;
        introLatencyMs = Date.now() - startChatClickedAt;
        break;
      }
      await sleep(1000);
    }

    console.log('INTRO_FOUND_WITHIN_20S=' + String(introFound));
    console.log('INTRO_LATENCY_MS=' + String(introLatencyMs));
    console.log('MESSAGE_COUNT_AFTER_START=' + String(seenCount));
    console.log('INTRO_MESSAGE_PREVIEW=' + (introMessage ? String(introMessage.message).slice(0, 160).replace(/\n/g, ' ') : 'NONE'));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error('FOCUS_CHECK_ERROR=' + error.stack);
  process.exit(1);
});
