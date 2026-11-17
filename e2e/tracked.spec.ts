import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('time actually worked can be shown on the calendar, growing while the timer runs', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'Write report');

  // Work on it 9:00 – 9:40, without going into focus mode.
  await card(page, 'Write report').hover();
  await page.keyboard.press(' ');
  await expect(page).toHaveURL(/\/focus\//);
  await page.clock.fastForward('40:00');
  await page.keyboard.press(' ');
  await page.keyboard.press('t');
  await expect(page).toHaveURL(/\/today$/);

  // Shown by default, and can be hidden.
  const tracked = page.getByTestId('tracked');
  await expect(tracked).toHaveAccessibleName('Worked on Write report, 09:00 – 09:40');
  await page.getByRole('button', { name: 'Show tracked time' }).click();
  await expect(tracked).toHaveCount(0);
  await page.getByRole('button', { name: 'Show tracked time' }).click();

  // A running timer shows as a block running to now.
  await card(page, 'Write report').hover();
  await page.keyboard.press(' ');
  await expect(page).toHaveURL(/\/focus\//);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.clock.fastForward('31:00');
  await expect(page.getByLabel(/^Worked on Write report, 09:40 – now$/)).toBeVisible();

  // Clicking a tracked block opens its task; the choice to show them is remembered.
  await tracked.first().click();
  await expect(page.getByRole('dialog').getByLabel('Task title')).toHaveValue('Write report');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show tracked time' })).toHaveAttribute('aria-pressed', 'true');
});
