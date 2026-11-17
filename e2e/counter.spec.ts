import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a task can count things, like job applications, from its card, the keyboard, or its page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'Apply to jobs', 'Read a book');

  // Add one from the card's hover row.
  await card(page, 'Apply to jobs').hover();
  await card(page, 'Apply to jobs').getByRole('button', { name: 'Add a counter' }).click();
  const pill = card(page, 'Apply to jobs').getByTestId('counter');
  await expect(pill).toHaveText('0');
  // Tasks without one are unchanged.
  await expect(card(page, 'Read a book').getByTestId('counter')).toHaveCount(0);

  // Set a target and unit on the task page.
  await card(page, 'Apply to jobs').getByText('Apply to jobs').click();
  const dialog = page.getByRole('dialog').first();
  await dialog.getByLabel('Target').fill('3');
  await dialog.getByLabel('What you are counting').fill('applications');
  await dialog.getByLabel('What you are counting').press('Enter');
  await dialog.getByRole('button', { name: 'Count one more' }).click();
  await expect(dialog.getByTestId('counter-value')).toHaveText('1 / 3');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The + on the card, and + on the keyboard while hovering.
  await expect(pill).toHaveText('1/3');
  await pill.getByRole('button', { name: 'Count one more for Apply to jobs' }).click();
  await expect(pill).toHaveText('2/3');
  await card(page, 'Apply to jobs').hover();
  await page.keyboard.press('+');
  await expect(pill).toHaveText('3/3');
  await expect(pill).toHaveAttribute('title', '3 of 3 applications');
  // Reaching the target does not complete the task.
  await expect(page.getByRole('checkbox', { name: 'Complete Apply to jobs' })).not.toBeChecked();

  await page.keyboard.press('-');
  await expect(pill).toHaveText('2/3');
  await page.keyboard.press('Control+z');
  await expect(pill).toHaveText('3/3');
});
