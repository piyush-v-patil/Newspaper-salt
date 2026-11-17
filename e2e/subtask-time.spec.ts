import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a subtask can be timed and given its own estimate; tracked time can be edited and logged by hand', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T10:00:00') });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'Launch page');
  await card(page, 'Launch page').click();
  const taskPage = page.getByRole('dialog').first();
  await taskPage.getByLabel('Add subtask').fill('Write copy');
  await taskPage.getByLabel('Add subtask').press('Enter');

  // Its own estimate.
  await taskPage.getByRole('button', { name: 'Set planned time for Write copy' }).click();
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await expect(taskPage.getByRole('button', { name: /Planned time for Write copy/ })).toHaveText('0:20');

  // Time it for 12 minutes.
  await taskPage.getByRole('listitem').filter({ has: page.getByLabel('Subtask') }).hover();
  await taskPage.getByRole('button', { name: 'Start Write copy' }).click();
  await expect(taskPage.getByRole('button', { name: 'Pause Write copy' })).toBeVisible();
  await page.clock.fastForward('12:00');
  await taskPage.getByRole('button', { name: 'Pause Write copy' }).click();
  await expect(taskPage.getByTestId('subtask-actual')).toHaveText('0:12');

  // Edit that entry to run 9:30 – 10:00.
  await taskPage.getByRole('button', { name: 'Actual time' }).click();
  const history = page.getByRole('dialog', { name: 'Actual time' });
  await expect(history).toContainText('Write copy');
  await history.getByRole('listitem').hover();
  await history.getByRole('button', { name: 'Edit entry' }).click();
  await history.getByLabel('Start').fill('09:30');
  await history.getByLabel('End').fill('10:00');
  await history.getByRole('button', { name: 'Save' }).click();
  await expect(history.getByRole('listitem')).toContainText('0:30');

  // An end before the start is refused.
  await history.getByRole('button', { name: 'Log time' }).click();
  await history.getByLabel('Start').fill('08:00');
  await history.getByLabel('End').fill('07:00');
  await history.getByRole('button', { name: 'Log' }).click();
  await expect(history).toContainText('The end has to be after the start.');
  await history.getByLabel('End').fill('08:45');
  await history.getByRole('button', { name: 'Log' }).click();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(taskPage.getByRole('button', { name: 'Actual time' })).toHaveText('1:15 actual');
});
