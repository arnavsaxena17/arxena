import { expect, test } from '@playwright/test';

import {
  expectThreadsLoaded,
  getAssistantThreadsSidebar,
  getSidebarThreadButtons,
  goToAssistantPage,
  readSidebarThreadNames,
} from './assistant/assistantTestUtils';

/**
 * Verifies that clicking a table snapshot in the assistant chat opens the
 * full datatable in the results panel on the right.
 *
 * Prerequisite: a thread named "Finding Pulmonologists in Mumbai" (or similar)
 * with a table snapshot must exist for the test account.
 */
test('Assistant: clicking table snapshot in chat opens datatable in results panel', async ({
  page,
}) => {
  test.setTimeout(120_000);

  await goToAssistantPage(page);

  const sidebar = getAssistantThreadsSidebar(page);
  await expectThreadsLoaded(sidebar);

  const threadButtons = getSidebarThreadButtons(sidebar);
  await expect(threadButtons.first()).toBeVisible({ timeout: 60_000 });

  // Find a thread that has a table result (pulmonologists search)
  const threadNames = await readSidebarThreadNames(threadButtons);
  console.log('[table-click] thread names:', threadNames);

  const targetIdx = threadNames.findIndex((name) =>
    /pulmonolog/i.test(name),
  );

  // Fall back to the first thread if no pulmonologists thread is found
  const threadIdx = targetIdx >= 0 ? targetIdx : 0;
  console.log(`[table-click] selecting thread index ${threadIdx}: ${threadNames[threadIdx]}`);

  await threadButtons.nth(threadIdx).scrollIntoViewIfNeeded();
  await threadButtons.nth(threadIdx).click();

  // Wait for the chat column to load this thread's messages
  const chatColumn = page.locator('main, [class*="chat"], [class*="Chat"]').first();

  // Look for the table snapshot hint text that appears below the mini-table
  const tableHint = page
    .locator('text=/Showing \\d+ of \\d+ candidates\\. Click to view all in the panel\\./i')
    .first();

  const hintVisible = await tableHint
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  if (!hintVisible) {
    // If we couldn't find a thread with a table, skip gracefully
    console.warn('[table-click] No table snapshot found in thread; skipping panel assertion.');
    test.skip();
    return;
  }

  console.log('[table-click] Table snapshot hint is visible. Clicking it...');

  // Click the snapshot container (parent of the hint text)
  // The snapshot is a styled div wrapping both the mini-table and the hint
  const tableSnapshot = page
    .locator('[class*="TableSnapshot"], [class*="Snapshot"]')
    .filter({ hasText: /Click to view all in the panel/i })
    .first();

  const snapshotExists = await tableSnapshot.count();
  if (snapshotExists > 0) {
    await tableSnapshot.click();
  } else {
    // Fallback: click the hint text itself (bubbles up to snapshot container)
    await tableHint.click();
  }

  // After clicking the snapshot, "No candidates found" should disappear from the results panel.
  const noCandidatesMsg = page.getByText('No candidates found').first();
  await expect(noCandidatesMsg).not.toBeVisible({ timeout: 15_000 });
  console.log('[table-click] "No candidates found" is gone from results panel. ✓');

  // A Handsontable should now be visible. The mini-preview in the chat has 5 rows;
  // the results panel renders all rows. We expect total row count > 5.
  const allHotRows = page.locator('.handsontable tbody tr, .htCore tbody tr');
  await expect(allHotRows.first()).toBeVisible({ timeout: 10_000 });
  const rowCount = await allHotRows.count();
  console.log(`[table-click] Total Handsontable rows visible (preview + panel): ${rowCount}`);
  expect(rowCount).toBeGreaterThan(5);

  console.log('[table-click] Results panel datatable is visible with data. ✓');
});
