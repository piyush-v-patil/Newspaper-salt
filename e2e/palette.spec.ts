import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

const palette = (page: Page) => page.getByRole('dialog', { name: 'Command palette' });

test('Ctrl+K runs commands by name, including from inside a text field', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  await page.keyboard.type('board');
  await expect(palette(page).getByRole('option')).toHaveText([/Go to Board/]);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/board$/);
  await expect(palette(page)).toHaveCount(0);

  // Settings sections are reachable too.
  await page.keyboard.press('Control+k');
  await page.keyboard.type('backup');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\?section=data$/);

  // It opens even while typing in a field.
  await page.goto('/today');
  await page.getByLabel(/^Add task to \d/).click();
  await page.keyboard.press('Control+k');
  await page.keyboard.type('dark mode');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the palette finds tasks by name and opens them', async ({ page }) => {
  const row = page.getByLabel(/^Add task to \d/);
  await row.fill('Renew passport');
  await row.press('Enter');
  await row.press('Escape');
  await expect(page.getByTestId('task')).toHaveCount(1);

  await page.keyboard.press('Control+k');
  await page.keyboard.type('passp');
  const option = palette(page).getByRole('option', { name: /Renew passport/ });
  await expect(option).toContainText('Today');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByLabel('Task title')).toHaveValue('Renew passport');
});

test('? shows every keyboard shortcut', async ({ page }) => {
  await page.keyboard.press('?');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Auto-schedule into the next free time');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});
