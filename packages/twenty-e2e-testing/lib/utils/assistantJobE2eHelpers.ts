import { expect, type Page } from '@playwright/test';
import path from 'path';

import {
  expectThreadsLoaded,
  getAssistantThreadsSidebar,
  goToAssistantPage,
} from '../../tests/assistant/assistantTestUtils';

export const defaultJdPath = path.resolve(
  __dirname,
  '../../../../../arxena-site/all_jds/JD - SAP SD.pdf',
);

export const createAssistantThreadAndUploadJd = async (
  page: Page,
  input?: {
    jdPath?: string;
  },
) => {
  const jdPath = input?.jdPath ?? defaultJdPath;

  await goToAssistantPage(page);

  const threadsSidebar = getAssistantThreadsSidebar(page);
  await expectThreadsLoaded(threadsSidebar);
  await threadsSidebar
    .getByRole('button', { name: /new thread/i })
    .first()
    .click();

  const threadNameInput = page.getByPlaceholder('Thread name');
  await expect(threadNameInput).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(async () => threadNameInput.inputValue(), { timeout: 20_000 })
    .toMatch(/new thread/i);

  await expect(threadsSidebar.getByText(/permissioned/i).first()).toBeVisible();
  const initialJobRow = page.getByText(/^No job attached$/).first();
  await expect(initialJobRow).toBeVisible();

  const threadActionsButton = page.getByTitle('Thread actions');
  await threadActionsButton.click();
  await threadActionsButton
    .locator('..')
    .getByRole('button', { name: /upload jd|replace jd/i })
    .click();

  await page.getByTestId('assistant-jd-file-input').setInputFiles(jdPath);

  const jobRow = page.getByText(/^(Job:\s|Job attached$|No job attached$)/).first();
  await expect(jobRow).toBeVisible({ timeout: 20_000 });
  await expect(jobRow).not.toHaveText(/^No job attached$/, { timeout: 20_000 });
  await expect(jobRow).toHaveText(/^Job:\s.+/, { timeout: 20_000 });

  const jobLabel = ((await jobRow.textContent()) ?? '').trim();
  const jobName = jobLabel.replace(/^Job:\s*/, '').trim();
  expect(jobName).toBeTruthy();

  return {
    jobName,
    jobLabel,
    jobRow,
  };
};
