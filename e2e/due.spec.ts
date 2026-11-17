import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a due date is set apart from the planned day, and a task due today is never lost', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') }); // a Tuesday
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'File taxes');

  // Set it on the task page by typing a date.
  await card(page, 'File taxes').click();
  await page.getByRole('button', { name: 'Due date' }).click();
  await page.keyboard.type('nov 19');
  await expect(page.getByRole('option', { name: /Thursday/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Due date' })).toHaveText('Due Thu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card(page, 'File taxes')).toContainText('Due Thu');

  // The badge opens the same picker; today turns it red.
  await card(page, 'File taxes').getByTitle('Due date').click();
  await page.getByRole('option', { name: /^Today/ }).click();
  await expect(card(page, 'File taxes').getByTitle('Due date')).toHaveText('Due today');

  // Sent to the backlog, it still shows up on today with a way back.
  await card(page, 'File taxes').hover();
  await page.keyboard.press('z');
  await expect(page.getByTestId('task')).toHaveCount(0);
  const notice = page.getByRole('region', { name: 'Due elsewhere' });
  await expect(notice).toContainText('File taxes');
  await notice.getByRole('button', { name: 'Move File taxes here' }).click();
  await expect(card(page, 'File taxes')).toBeVisible();
  await expect(notice).toHaveCount(0);
});
