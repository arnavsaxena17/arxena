import { expect, test } from '@playwright/test';
import path from 'path';

import {
  expectThreadsLoaded,
  getAssistantThreadsSidebar,
  goToAssistantPage,
} from './assistant/assistantTestUtils';

test('Assistant: new thread -> upload JD -> job hydrates + Jobs nav updates', async ({ page }) => {
  test.setTimeout(180_000);

  await goToAssistantPage(page);

  const threadsSidebar = getAssistantThreadsSidebar(page);
  await expectThreadsLoaded(threadsSidebar);

  // Create a new thread from the thread sidebar (not the page header).
  await threadsSidebar.getByRole('button', { name: /new thread/i }).first().click();
  console.log("New thread clicked")

  const threadNameInput = page.getByPlaceholder('Thread name');
  console.log("Timeing out to wait for thread name input to be visible");
  await expect(threadNameInput).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => threadNameInput.inputValue(), { timeout: 20_000 }).toMatch(
    /new thread/i,
  );

  // New thread starts permissioned and has no job attached.
  await expect(threadsSidebar.getByText(/permissioned/i).first()).toBeVisible();
  const initialJobRow = page.getByText(/^No job attached$/).first();
  await expect(initialJobRow).toBeVisible();
  console.log('Found no job attached');

  // Open the 3-dots menu and pick Upload/Replace JD.
  console.log('Clicking thread actions');
  await page.getByTitle('Thread actions').click();
  console.log('Thread actions clicked');
  await page.getByRole('button', { name: /upload jd|replace jd/i }).click();
  console.log('Upload/Replace JD clicked');
  // Selecting a file is done via the hidden file input triggered by the menu action.
  const jdPath = path.resolve(
    __dirname,
    '../../../sample_jds/JD - SAP SD.pdf',
  );
  console.log('JD path', jdPath);
  await page.getByTestId('assistant-jd-file-input').setInputFiles(jdPath);

  // The JD upload flow should complete and the attached job should hydrate
  // from "No job attached" to a concrete job attachment name.
  const jobRow = page.getByText(/^(Job:\s|Job attached$|No job attached$)/).first();

  console.log('Job row locator created');
  await expect(jobRow).toBeVisible({ timeout: 20_000 });
  console.log("Job row is visible");

  // Wait for the UI to reflect that a specific job is attached.
  // It should no longer read "No job attached" and instead show "Job: <Job name>".
  await expect(jobRow).not.toHaveText(/^No job attached$/, { timeout: 20_000 });
  console.log("Job row is not No job attached");
  await expect(jobRow).toHaveText(/^Job:\s.+/, { timeout: 20_000 });
  console.log("Job row has text Job: <Job name>");
});

