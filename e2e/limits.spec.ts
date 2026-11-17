import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a weekday can have its own workload limit', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T08:00:00') }); // a Friday
  await page.goto('/settings?section=schedule');
  await page.getByRole('switch', { name: 'Different limit on some days' }).click();
  await page.getByLabel('Friday workload limit in hours').fill('2');
  await page.getByLabel('Friday workload limit in hours').press('Tab');
  await page.goto('/today');
  await addTasks(page, 'Wrap up the week ~3h #work');
  const counter = page.getByTestId('workload').first();
  await expect(counter).toHaveAttribute('data-level', 'over');
  await expect(counter).toContainText('over by 1:00');
});

test('a channel can have its own hours for auto-scheduling', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T08:00:00') });
  await page.goto('/settings?section=channels');
  await page.getByRole('button', { name: 'Hours of #personal' }).click();
  await page.getByRole('checkbox', { name: 'Own hours' }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Hours of #personal' })).toContainText('18:00 – 21:00');
  // Saved, not just shown.
  await expect(page.getByRole('button', { name: 'Hours of #personal' })).toHaveAttribute('aria-busy', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Hours of #personal' })).toContainText('18:00 – 21:00');

  await page.goto('/today');
  await addTasks(page, 'Groceries ~45 #personal');
  await card(page, 'Groceries').hover();
  await page.keyboard.press('x');
  await expect(page.getByTestId('session')).toHaveAccessibleName('Groceries, 18:00 – 18:45');
});
