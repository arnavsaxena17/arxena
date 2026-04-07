import { expect, test } from '@playwright/test';

import {
  completeJobCreationFromJobsUpload,
  defaultQuestionOne,
  defaultQuestionTwo,
} from '../lib/utils/jobCreationE2eHelpers';

test.use({ storageState: { cookies: [], origins: [] } });

test('Jobs: add new job pipeline including JD upload and chat questions', async ({
  page,
}) => {
  test.setTimeout(300_000);

  const { extraQuestion } = await completeJobCreationFromJobsUpload(page);

  const editModalTitle = page.getByText(/Edit Job Details/i).first();
  if (!(await editModalTitle.isVisible().catch(() => false))) {
    const iconButtons = page.locator('button:has(svg)');
    const iconCount = await iconButtons.count();
    const tooltipLocator = page.getByText(/Modify Job Details/i);

    let opened = false;
    for (let i = 0; i < Math.min(iconCount, 12); i += 1) {
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
        // Continue scanning icon actions until the matching tooltip appears.
      }
    }

    expect(opened).toBeTruthy();
  }

  await expect(editModalTitle).toBeVisible({ timeout: 60_000 });

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
      (q) => q.trim().toLowerCase() === extraQuestion.toLowerCase(),
    ),
  ).toBeTruthy();
});
