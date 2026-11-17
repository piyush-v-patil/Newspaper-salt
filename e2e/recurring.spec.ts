import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a task can be made to repeat, edited across the series, and stopped', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') }); // a Tuesday
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  const row = page.getByLabel(/^Add task to \d/);
  await row.fill('Stand-up notes ~15');
  await row.press('Enter');
  await row.press('Escape');

  await card(page, 'Stand-up notes').click();
  const taskPage = page.getByRole('dialog').first();
  await taskPage.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Repeat…' }).click();
  const repeat = page.getByRole('dialog', { name: 'Repeat this task' });
  await repeat.getByRole('radio', { name: 'Weekly' }).click();
  await repeat.getByRole('button', { name: 'Thu' }).click();
  await expect(repeat).toContainText('Every week on Tue, Thu');
  await repeat.getByRole('button', { name: 'Repeat', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(card(page, 'Stand-up notes').getByLabel('Repeats')).toBeVisible();
  // Wednesday has none; Thursday has one.
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('task')).toHaveCount(0);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(card(page, 'Stand-up notes')).toContainText('0:15');

  // Rename this instance and push the change to the rest of the series.
  await card(page, 'Stand-up notes').click();
  await page.getByRole('dialog').first().getByLabel('Task title').fill('Daily notes');
  await page.getByRole('dialog').first().getByLabel('Task title').press('Enter');
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Repeating…' }).click();
  await page.getByRole('button', { name: /Update all incomplete instances/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Shift+Space');
  await expect(card(page, 'Daily notes')).toBeVisible();

  // Stop the series: today's stays, Thursday's goes.
  await card(page, 'Daily notes').click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Repeating…' }).click();
  await page.getByRole('button', { name: /^Stop repeating/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card(page, 'Daily notes')).toBeVisible();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('task')).toHaveCount(0);
});
