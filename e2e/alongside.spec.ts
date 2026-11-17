import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a second task can be timed alongside the main one', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'Laundry', 'Write report');

  // Start the main timer, then go back to the list.
  await card(page, 'Write report').hover();
  await page.keyboard.press(' ');
  await expect(page).toHaveURL(/\/focus\//);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);

  // Laundry runs alongside, picked from the bar.
  const bar = page.getByRole('region', { name: 'Focus bar' });
  await bar.getByRole('button', { name: 'Time another task alongside' }).click();
  await page.getByRole('textbox', { name: 'Time alongside' }).fill('laun');
  await page.keyboard.press('Enter');
  await expect(bar.getByTestId('alongside')).toContainText('Laundry');

  await page.clock.fastForward('20:00');
  await expect(card(page, 'Laundry')).toContainText('0:20');
  await expect(card(page, 'Write report')).toContainText('0:20');

  // Stop it from the bar; the main timer keeps going.
  await bar.getByRole('button', { name: 'Stop Laundry' }).click();
  await expect(bar.getByTestId('alongside')).toHaveCount(0);
  await page.clock.fastForward('10:00');
  await expect(card(page, 'Laundry')).toContainText('0:20');
  await expect(card(page, 'Write report')).toContainText('0:30');

  // And from the task page menu.
  await card(page, 'Laundry').getByText('Laundry').click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Time alongside' }).click();
  await page.keyboard.press('Escape');
  await expect(bar.getByTestId('alongside')).toContainText('Laundry');
});
