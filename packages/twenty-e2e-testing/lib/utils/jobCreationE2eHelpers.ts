import { expect, type Page } from '@playwright/test';
import path from 'path';

import { signInWithExistingCredentials } from './authFlowE2eHelpers';

export const defaultJdPath = path.resolve(
  __dirname,
  '../../../../../arxena-site/all_jds/JD - SAP SD.pdf',
);

export const defaultQuestionOne = 'What is your current and expected CTC?';
export const defaultQuestionTwo =
  'Who do you report to, which functions report to you?';

export const goToJobsPage = async (page: Page) => {
  await signInWithExistingCredentials(page, {
    targetPath: '/jobs',
  });
  await page.waitForURL(/\/jobs(?:[/?#]|$)/, { timeout: 60_000 });
  await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
};

export const uploadJdFromJobsAndReachJobDetails = async (
  page: Page,
  input?: {
    jdPath?: string;
    skipSignIn?: boolean;
  },
) => {
  const jdPath = input?.jdPath ?? defaultJdPath;

  if (input?.skipSignIn) {
    console.log('[jobs-upload] reusing signed-in session', {
      currentUrl: page.url(),
    });
    // When the caller has already signed in and reached /jobs, act on that
    // page immediately instead of waiting through another navigation cycle.
    if (!/\/jobs(?:[/?#]|$)/.test(page.url())) {
      throw new Error(
        `[jobs-upload] expected to start on /jobs after sign-in, but got ${page.url()}`,
      );
    }
  } else {
    console.log('[jobs-upload] signing in through jobs page');
    await goToJobsPage(page);
  }

  console.log('[jobs-upload] landed on jobs page', {
    url: page.url(),
    title: await page.title().catch(() => ''),
  });

  const mergeCancelButton = page.getByTestId('merge-cancel').first();
  if (await mergeCancelButton.isVisible().catch(() => false)) {
    console.log('[jobs-upload] merge mode detected, cancelling');
    await mergeCancelButton.click({ force: true });
    await expect(mergeCancelButton)
      .toBeHidden({ timeout: 15_000 })
      .catch(() => {});
  }

  const jobsMenuButton = page.getByTestId('candidate-table-jobs-menu').first();
  const jobsMenuFallbackButton = page
    .getByRole('button', { name: /open jobs menu/i })
    .first();
  const activeJobsHeading = page.getByText(/Active Jobs/i).first();

  await Promise.race([
    jobsMenuButton.waitFor({ state: 'visible', timeout: 30_000 }),
    jobsMenuFallbackButton.waitFor({ state: 'visible', timeout: 30_000 }),
    activeJobsHeading.waitFor({ state: 'visible', timeout: 30_000 }),
  ]).catch(() => {});

  console.log('[jobs-upload] jobs page probes', {
    url: page.url(),
    hasJobsMenuTestId: await jobsMenuButton.isVisible().catch(() => false),
    hasJobsMenuAria: await jobsMenuFallbackButton.isVisible().catch(() => false),
    hasActiveJobs: await activeJobsHeading.isVisible().catch(() => false),
  });

  const resolvedJobsMenuButton =
    (await jobsMenuButton.isVisible().catch(() => false))
      ? jobsMenuButton
      : jobsMenuFallbackButton;
  await expect(resolvedJobsMenuButton).toBeVisible({ timeout: 30_000 });
  console.log('[jobs-upload] opening jobs menu');
  await resolvedJobsMenuButton.click({ force: true });

  const addJobButton = page.getByTestId('add-new-job').first();
  const addJobButtonByText = page.getByRole('menuitem', { name: /add new job/i }).first();
  await Promise.race([
    addJobButton.waitFor({ state: 'visible', timeout: 30_000 }),
    addJobButtonByText.waitFor({ state: 'visible', timeout: 30_000 }),
  ]).catch(() => {});
  console.log('[jobs-upload] add-job probes', {
    hasAddJobTestId: await addJobButton.isVisible().catch(() => false),
    hasAddJobMenuItem: await addJobButtonByText.isVisible().catch(() => false),
  });
  const resolvedAddJobButton =
    (await addJobButton.isVisible().catch(() => false))
      ? addJobButton
      : addJobButtonByText;
  await expect(resolvedAddJobButton).toBeVisible({ timeout: 30_000 });
  console.log('[jobs-upload] clicking add new job');
  await resolvedAddJobButton.click({ force: true });

  const uploadJobDescriptionTitle = page.getByText(/Upload Job Description/i).first();
  console.log('[jobs-upload] waiting for upload modal');
  await expect(uploadJobDescriptionTitle).toBeVisible({ timeout: 30_000 });

  console.log('[jobs-upload] setting JD file', { jdPath });
  await page.locator('input[type="file"]').first().setInputFiles(jdPath);
  await expect(page.getByText(path.basename(jdPath))).toBeVisible({
    timeout: 120_000,
  });

  const continueToJobDetailsButton = page
    .getByRole('button', { name: /continue to job details/i })
    .first();
  console.log('[jobs-upload] waiting for continue to job details');
  await expect(continueToJobDetailsButton).toBeVisible({ timeout: 120_000 });
  await continueToJobDetailsButton.click();

  const jobTitleInput = page.getByPlaceholder('Enter job title (Required)').first();
  const pitchInput = page
    .getByPlaceholder('A one line pitch for the job (Required)')
    .first();

  console.log('[jobs-upload] waiting for hydrated job details');
  await expect(jobTitleInput).toBeVisible({ timeout: 60_000 });
  await expect(pitchInput).toBeVisible({ timeout: 60_000 });
  await expect(jobTitleInput).not.toHaveValue('', { timeout: 60_000 });
  await expect(pitchInput).not.toHaveValue('', { timeout: 60_000 });

  const jobName = (await jobTitleInput.inputValue()).trim();
  expect(jobName).toBeTruthy();

  return {
    jdPath,
    jobName,
    jobTitleInput,
    pitchInput,
  };
};

export const completeJobCreationFromJobsUpload = async (
  page: Page,
  input?: {
    jdPath?: string;
    skipSignIn?: boolean;
    recruiterPhone?: string;
    recruiterJobTitle?: string;
    extraQuestion?: string;
  },
) => {
  const recruiterPhone = input?.recruiterPhone ?? '+919999999999';
  const recruiterJobTitle = input?.recruiterJobTitle ?? 'Talent Partner';
  const extraQuestion = input?.extraQuestion ?? 'What is your notice period';

  const { jobName } = await uploadJdFromJobsAndReachJobDetails(page, input);

  const recruiterPhoneInput = page
    .getByPlaceholder('Enter your phone number (Required)')
    .first();
  if (await recruiterPhoneInput.isVisible().catch(() => false)) {
    await recruiterPhoneInput.scrollIntoViewIfNeeded().catch(() => {});
    await recruiterPhoneInput.fill(recruiterPhone);
  }

  const recruiterJobTitleInput = page
    .getByPlaceholder('Enter your job title (Required)')
    .first();
  const recruiterJobTitleFallbackInput = page
    .getByLabel(/Recruiter's Job Title/i)
    .first();
  const resolvedRecruiterJobTitleInput =
    (await recruiterJobTitleInput.isVisible().catch(() => false))
      ? recruiterJobTitleInput
      : recruiterJobTitleFallbackInput;
  if (await resolvedRecruiterJobTitleInput.isVisible().catch(() => false)) {
    await resolvedRecruiterJobTitleInput.scrollIntoViewIfNeeded().catch(
      () => {},
    );
    await resolvedRecruiterJobTitleInput.fill(recruiterJobTitle);
  }

  const nextButton = page.getByRole('button', { name: /^Next$/i }).first();
  await expect(nextButton).toBeVisible({ timeout: 60_000 });
  await nextButton.click();

  const addQuestionButton = page.getByRole('button', { name: /add question/i }).first();
  try {
    await expect(addQuestionButton).toBeVisible({ timeout: 15_000 });
  } catch {
    const recruiterJobTitleError = page
      .getByText(/Recruiter's Job Title/i)
      .filter({ hasText: /required/i })
      .first();

    if (await recruiterJobTitleError.isVisible().catch(() => false)) {
      const retryRecruiterJobTitleInput =
        (await recruiterJobTitleInput.isVisible().catch(() => false))
          ? recruiterJobTitleInput
          : recruiterJobTitleFallbackInput;
      await retryRecruiterJobTitleInput.scrollIntoViewIfNeeded().catch(
        () => {},
      );
      await retryRecruiterJobTitleInput.fill(recruiterJobTitle);
      await nextButton.click();
    }

    await expect(addQuestionButton).toBeVisible({ timeout: 60_000 });
  }

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

  await questionInputs.nth(questionCount - 1).fill(extraQuestion);

  const finishButton = page.getByRole('button', { name: /finish/i }).first();
  await expect(finishButton).toBeVisible({ timeout: 60_000 });
  await finishButton.click();

  await expect(page.getByText(/Creating job process/i)).toBeHidden({
    timeout: 180_000,
  });
  await expect(page.getByText(/Add a New Job Description/i).first()).toBeHidden({
    timeout: 180_000,
  });

  await expect(page.getByText('Active Jobs').first()).toBeVisible({
    timeout: 60_000,
  });

  const newestActiveStatus = page.getByText(/^Active$/).first();
  await expect(newestActiveStatus).toBeVisible({ timeout: 60_000 });
  await newestActiveStatus.click({ force: true });

  const searchCandidates = page.getByPlaceholder(/Search candidates/i).first();
  try {
    await expect(searchCandidates).toBeVisible({ timeout: 60_000 });
  } catch {
    await page.locator('h3').first().click({ force: true });
    await expect(searchCandidates).toBeVisible({ timeout: 60_000 });
  }

  await expect(page).toHaveURL(/\/job\/[^/?#]+(?:[/?#]|$)/);
  const jobUrl = page.url();
  const jobId =
    jobUrl.match(/\/job\/([^/?#]+)/)?.[1] ??
    (() => {
      throw new Error(`Could not extract created job id from URL: ${jobUrl}`);
    })();

  return {
    jobId,
    jobName,
    extraQuestion,
  };
};
