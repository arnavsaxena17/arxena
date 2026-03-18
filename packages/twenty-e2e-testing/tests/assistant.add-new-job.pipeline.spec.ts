import { expect, test, type Page } from '@playwright/test';
import path from 'path';

import { goToAssistantPage } from './assistant/assistantTestUtils';

test.use({ storageState: { cookies: [], origins: [] } });

const navigateToJobs = async (page: Page) => {
  await goToAssistantPage(page);

  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/jobs`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL(/\/jobs(?:[/?#]|$)/, { timeout: 60_000 });
  await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
};

test('Assistant: add new job pipeline including JD upload and chat questions', async ({ page }) => {
  test.setTimeout(300_000);

  await navigateToJobs(page);

  // Ensure we're not in "merge mode" (which can hide/obstruct the add-job flow).
  const mergeCancelButton = page.getByTestId('merge-cancel').first();
  if (await mergeCancelButton.isVisible().catch(() => false)) {
    await mergeCancelButton.click({ force: true });
    await expect(mergeCancelButton).toBeHidden({ timeout: 15_000 }).catch(() => {});
  }

  const addJobButton = page.getByTestId('add-new-job').first();
  await expect(addJobButton).toBeVisible({ timeout: 30_000 });
  await addJobButton.click({ force: true });

  const fileInputLocator = page.locator('input[type="file"]');
  const uploadJobDescriptionTitle = page.getByText(/Upload Job Description/i).first();

  const dialogsLocator = page.getByRole('dialog');

  // #region agent log
  await fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fa70e8' },
    body: JSON.stringify({
      sessionId: 'fa70e8',
      runId: 'pre-fix',
      hypothesisId: 'H1_modal_not_opening_or_wrong_ui',
      location: 'assistant.add-new-job.pipeline.spec.ts:add-job-click',
      message: 'state right after clicking Add New Job',
      data: {
        urlAfterClick: page.url(),
        dialogsCountAfterClick: await dialogsLocator.count(),
        fileInputVisibleAfterClick: await fileInputLocator.first().isVisible().catch(() => false),
        uploadJobDescriptionTitleCountAfterClick: await uploadJobDescriptionTitle.count(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    await expect(uploadJobDescriptionTitle).toBeVisible({ timeout: 30_000 });
  } catch (error) {
    // #region agent log
    await fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fa70e8' },
      body: JSON.stringify({
        sessionId: 'fa70e8',
        runId: 'pre-fix',
        hypothesisId: 'H2_title_mismatch_or_modal_never_opens_or_slow_render',
        location: 'assistant.add-new-job.pipeline.spec.ts:add-job-modal-title-wait',
        message: 'state when upload modal title not found',
        data: {
          urlNow: page.url(),
          dialogsCountNow: await dialogsLocator.count(),
          dialogVisibleNow: await dialogsLocator.first().isVisible().catch(() => false),
          fileInputCountNow: await fileInputLocator.count(),
          fileInputVisibleNow: await fileInputLocator.first().isVisible().catch(() => false),
          uploadJobDescriptionTitleCountNow: await uploadJobDescriptionTitle.count(),
          uploadJobDescriptionTitleVisibleNow: await uploadJobDescriptionTitle.isVisible().catch(() => false),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    throw error;
  }

  const jdPath = path.resolve(
    __dirname,
    '../../../sample_jds/JD - SAP SD.pdf',
  );

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(jdPath);

  await expect(page.getByText('JD - SAP SD.pdf')).toBeVisible({ timeout: 120_000 });

  const continueToJobDetailsButton = page
    .getByRole('button', { name: /continue to job details/i })
    .first();
  await expect(continueToJobDetailsButton).toBeVisible({ timeout: 120_000 });
  await continueToJobDetailsButton.click();

  const jobTitleInput = page.getByPlaceholder('Enter job title (Required)').first();
  const pitchInput = page.getByPlaceholder('A one line pitch for the job (Required)').first();

  await expect(jobTitleInput).toBeVisible({ timeout: 60_000 });
  await expect(pitchInput).toBeVisible({ timeout: 60_000 });
  await expect(jobTitleInput).not.toHaveValue('', { timeout: 60_000 });
  await expect(pitchInput).not.toHaveValue('', { timeout: 60_000 });

  const recruiterPhoneInput = page
    .getByPlaceholder('Enter your phone number (Required)')
    .first();
  if (await recruiterPhoneInput.isVisible().catch(() => false)) {
    await recruiterPhoneInput.fill('+919999999999');
  }

  const recruiterJobTitleInput = page
    .getByPlaceholder('Enter your job title (Required)')
    .first();
  if (await recruiterJobTitleInput.isVisible().catch(() => false)) {
    await recruiterJobTitleInput.fill('Talent Partner');
  }

  const nextButton = page.getByRole('button', { name: /^Next$/i }).first();
  await expect(nextButton).toBeVisible({ timeout: 60_000 });
  await nextButton.click();

  const addQuestionButton = page.getByRole('button', { name: /add question/i }).first();
  await expect(addQuestionButton).toBeVisible({ timeout: 60_000 });

  const defaultQuestionOne = 'What is your current and expected CTC?';
  const defaultQuestionTwo = 'Who do you report to, which functions report to you?';

  const existingQuestionInputs = page.getByPlaceholder('Enter question');
  const existingQuestionCount = await existingQuestionInputs.count();
  expect(existingQuestionCount).toBeGreaterThanOrEqual(2);

  const existingQuestionValues: string[] = [];
  for (let i = 0; i < existingQuestionCount; i += 1) {
    existingQuestionValues.push(await existingQuestionInputs.nth(i).inputValue());
  }

  expect(existingQuestionValues).toContain(defaultQuestionOne);
  expect(existingQuestionValues).toContain(defaultQuestionTwo);
  await addQuestionButton.click();

  const questionInputs = page.getByPlaceholder('Enter question');
  const questionCount = await questionInputs.count();
  expect(questionCount).toBeGreaterThanOrEqual(3);

  const newQuestionInput = questionInputs.nth(questionCount - 1);
  await newQuestionInput.fill('What is your notice period');

  const finishButton = page.getByRole('button', { name: /finish/i }).first();
  await expect(finishButton).toBeVisible({ timeout: 60_000 });
  await finishButton.click();

  // Wait for backend job creation to finish and modal to close.
  await expect(page.getByText(/Creating job process/i)).toBeHidden({
    timeout: 180_000,
  });

  const creatingJobProcessText = page.getByText(/Creating job process/i).first();
  const addNewJobDescriptionTitle = page.getByText(/Add a New Job Description/i).first();

  // #region agent log
  await fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fa70e8' },
    body: JSON.stringify({
      sessionId: 'fa70e8',
      runId: 'pre-fix_modal-close-check-1',
      hypothesisId: 'H3_modal_not_closed_blocks_navigation',
      location: 'assistant.add-new-job.pipeline.spec.ts:post-create-wait',
      message: 'state right after waiting for creating job process hidden',
      data: {
        urlNow: page.url(),
        creatingJobProcessVisibleNow: await creatingJobProcessText.isVisible().catch(() => false),
        addNewJobDescriptionTitleVisibleNow: await addNewJobDescriptionTitle.isVisible().catch(() => false),
        dialogsCountNow: await dialogsLocator.count(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  await expect(addNewJobDescriptionTitle).toBeHidden({ timeout: 180_000 });

  // After finish, we land back on /jobs. Click the newest job (createdAt-desc) by using the first "Active" footer.
  await expect(page.getByText('Active Jobs').first()).toBeVisible({ timeout: 60_000 });
  const newestActiveStatus = page.getByText(/^Active$/).first();
  await expect(newestActiveStatus).toBeVisible({ timeout: 60_000 });

  const searchCandidates = page.getByPlaceholder(/Search candidates/i).first();

  // #region agent log
  await fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fa70e8' },
    body: JSON.stringify({
      sessionId: 'fa70e8',
      runId: 'pre-fix_modal-close-check-1',
      hypothesisId: 'H4_navigation_click_flaky_due_to_overlay',
      location: 'assistant.add-new-job.pipeline.spec.ts:before-active-click',
      message: 'state before clicking newest Active job',
      data: {
        urlNow: page.url(),
        searchCandidatesVisibleNow: await searchCandidates.isVisible().catch(() => false),
        searchCandidatesCountNow: await page.getByPlaceholder(/Search candidates/i).count(),
        addNewJobDescriptionTitleVisibleNow: await addNewJobDescriptionTitle.isVisible().catch(() => false),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  await newestActiveStatus.click({ force: true });

  try {
    await expect(searchCandidates).toBeVisible({ timeout: 60_000 });
  } catch (e) {
    // Fallback: click the first visible job-card title.
    // #region agent log
    await fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fa70e8' },
      body: JSON.stringify({
        sessionId: 'fa70e8',
        runId: 'pre-fix_modal-close-check-1',
        hypothesisId: 'H5_fallback_h3_click_does_not_navigate',
        location: 'assistant.add-new-job.pipeline.spec.ts:active-click-search-candidates-timeout',
        message: 'search candidates not visible after clicking Active; attempting fallback',
        data: {
          urlNow: page.url(),
          searchCandidatesVisibleNow: await searchCandidates.isVisible().catch(() => false),
          searchCandidatesCountNow: await page.getByPlaceholder(/Search candidates/i).count(),
          dialogsCountNow: await dialogsLocator.count(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    await page.locator('h3').first().click({ force: true });
    await expect(page.getByPlaceholder(/Search candidates/i).first()).toBeVisible({ timeout: 60_000 });
  }

  await expect(page).toHaveURL(/\/job\/[^/?#]+(?:[/?#]|$)/);

  // Try to open "Edit Job Details" modal from the icon-only top-bar action.
  const editModalTitle = page.getByText(/Edit Job Details/i).first();
  if (!(await editModalTitle.isVisible().catch(() => false))) {
    // The "Modify Job Details" trigger uses a tooltip that appears on hover,
    // so we locate the correct icon by checking which one renders that tooltip text.
    const iconButtons = page.locator('button:has(svg)');
    const iconCount = await iconButtons.count();
    const tooltipLocator = page.getByText(/Modify Job Details/i);

    let opened = false;
    for (let i = 0; i < Math.min(iconCount, 12); i += 1) {
      // Tooltip is anchored to a wrapper element with an id like `tooltip-<random>`.
      const tooltipAnchor = iconButtons
        .nth(i)
        .locator('xpath=ancestor-or-self::*[starts-with(@id,"tooltip-")][1]');
      await tooltipAnchor.hover({ force: true });

      try {
        await expect(tooltipLocator.first()).toBeVisible({ timeout: 3_000 });
        await iconButtons.nth(i).click({ force: true });
        opened = true;
        break;
      } catch {
        // Tooltip didn't show for this icon; continue.
      }
    }

    expect(opened).toBeTruthy();
  }

  await expect(page.getByText(/Edit Job Details/i)).toBeVisible({ timeout: 60_000 });

  for (let i = 0; i < 6; i += 1) {
    const chatQuestionsHeader = page.getByText('Chat Questions').first();
    if (await chatQuestionsHeader.isVisible().catch(() => false)) {
      break;
    }

    const maybeNext = page.getByRole('button', { name: /^Next$/i }).first();
    if (await maybeNext.isVisible().catch(() => false)) {
      await maybeNext.click();
      continue;
    }

    break;
  }

  const allQuestionInputs = page.getByPlaceholder('Enter question');
  const allQuestionCount = await allQuestionInputs.count();
  expect(allQuestionCount).toBeGreaterThanOrEqual(3);

  const questionValues: string[] = [];
  for (let i = 0; i < allQuestionCount; i += 1) {
    questionValues.push(await allQuestionInputs.nth(i).inputValue());
  }

  expect(questionValues).toContain(defaultQuestionOne);
  expect(questionValues).toContain(defaultQuestionTwo);
  expect(
    questionValues.some(
      (q) => q.trim().toLowerCase() === 'what is your notice period'.toLowerCase(),
    ),
  ).toBeTruthy();
}
);

