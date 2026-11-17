import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openAt(page: Page, time: string) {
  await page.clock.install({ time: new Date(`2026-11-17T${time}:00`) });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

async function quickAdd(page: Page, ...titles: string[]) {
  const row = page.getByLabel(/^Add task to/).first();
  for (const title of titles) {
    await row.fill(title);
    await row.press('Enter');
  }
  await row.press('Escape');
}

test('Space starts a timer and enters focus mode; the time survives a pause and a reload', async ({ page }) => {
  await openAt(page, '09:00');
  await quickAdd(page, 'Draft report ~30');
  await card(page, 'Draft report').hover();
  await page.keyboard.press(' ');
  await expect(page).toHaveURL(/\/focus\/.+/);
  await expect(page.getByLabel('Task title')).toHaveValue('Draft report');
  // Focus mode clears the panels away.
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('12:30');
  await expect(page.getByTestId('focus-timer')).toHaveText(/^12:3\d$/);
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.clock.fastForward('05:00');
  await expect(page.getByTestId('focus-timer')).toHaveText(/^12:3\d$/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/today$/);
  await expect(card(page, 'Draft report').getByTestId('card-time')).toHaveText('0:12/0:30');
  await expect(page.getByRole('region', { name: 'Focus bar' })).toContainText('Draft report');

  await page.reload();
  await expect(card(page, 'Draft report').getByTestId('card-time')).toHaveText('0:12/0:30');
});

test('a running timer keeps counting across a reload and shows in the focus bar', async ({ page }) => {
  await openAt(page, '09:00');
  await quickAdd(page, 'Review designs');
  await card(page, 'Review designs').hover();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('03:00');
  await page.keyboard.press('t');
  await expect(page.getByTestId('focus-bar-time')).toHaveText(/^3:0\d$/);

  await page.reload();
  const bar = page.getByRole('region', { name: 'Focus bar' });
  await expect(bar.getByRole('button', { name: 'Pause timer' })).toBeVisible();
  await page.clock.fastForward('02:00');
  await expect(card(page, 'Review designs').getByTestId('card-time')).toHaveText('0:05/–:––');
  // Space on the card pauses it this time.
  await card(page, 'Review designs').hover();
  await page.keyboard.press(' ');
  await expect(bar.getByRole('button', { name: 'Start timer' })).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
  await page.clock.fastForward('04:00');
  await expect(card(page, 'Review designs').getByTestId('card-time')).toHaveText('0:05/–:––');
});

test('completing in focus mode moves to the next task, then celebrates when the list is empty', async ({ page }) => {
  await openAt(page, '09:00');
  await quickAdd(page, 'Second', 'First');
  await card(page, 'First').hover();
  await page.keyboard.press('f');
  await expect(page.getByLabel('Task title')).toHaveValue('First');
  // F does not start the timer by itself.
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByLabel('Task title')).toHaveValue('Second');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByLabel('Task title')).toHaveValue('First');

  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('10:00');
  await page.keyboard.press('c');
  await expect(page.getByLabel('Task title')).toHaveValue('Second');
  // The timer carries straight on with the next task.
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Done for the day' })).toBeVisible();
  await expect(page.getByTestId('celebration')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(card(page, 'First').getByTestId('card-time')).toHaveText('0:10/–:––');
  await expect(page.getByRole('checkbox', { name: 'Reopen Second' })).toBeChecked();
});

test('actual time can be typed in, and the workload counter can show actual against planned', async ({ page }) => {
  await openAt(page, '15:00');
  await quickAdd(page, 'Call supplier ~30');
  await card(page, 'Call supplier').hover();
  await page.keyboard.press('e');
  await page.getByPlaceholder('e.g. 45 or 1h30').fill('45');
  await page.keyboard.press('Enter');
  await expect(card(page, 'Call supplier').getByTestId('card-time')).toHaveText('0:45/0:30');

  const counter = page.getByTestId('workload').first();
  await counter.click();
  await counter.click();
  await expect(counter).toContainText('0:45 / 0:30');

  // The entry is listed on the task page and can be removed.
  await card(page, 'Call supplier').click();
  const dialog = page.getByRole('dialog').first();
  await dialog.getByRole('button', { name: 'Actual time' }).click();
  await expect(page.getByText('History')).toBeVisible();
  await page.getByRole('button', { name: 'Delete entry' }).click({ force: true });
  await expect(dialog.getByRole('button', { name: 'Actual time' })).toHaveText('Actual');
});

test('K takes a break, and ending it resumes the timer', async ({ page }) => {
  await openAt(page, '09:00');
  await quickAdd(page, 'Deep work');
  await card(page, 'Deep work').hover();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('20:00');
  await page.keyboard.press('t');
  const bar = page.getByRole('region', { name: 'Focus bar' });
  await expect(bar.getByRole('button', { name: 'Pause timer' })).toBeVisible();

  await page.keyboard.press('k');
  await expect(bar).toContainText('On a break');
  await page.clock.fastForward('05:10');
  await expect(page.getByText("Break's over. Ready to get back to it?")).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(bar.getByRole('button', { name: 'Pause timer' })).toBeVisible();
  // The break itself was not counted.
  await expect(card(page, 'Deep work').getByTestId('card-time')).toHaveText('0:20/–:––');
});

test('a timeboxed task about to start offers to shift focus', async ({ page }) => {
  await openAt(page, '08:50');
  await quickAdd(page, 'Standup prep ~15', 'Inbox');
  await card(page, 'Standup prep').hover();
  await page.keyboard.press('x');
  await expect(page.getByTestId('session')).toHaveAccessibleName('Standup prep, 09:00 – 09:15');

  await card(page, 'Inbox').hover();
  await page.keyboard.press(' ');
  await expect(page.getByLabel('Task title')).toHaveValue('Inbox');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('06:00');
  await expect(page.getByText('Standup prep starts soon. Shift focus?')).toBeVisible();
  await page.getByRole('button', { name: 'Shift focus' }).click();
  await expect(page.getByLabel('Task title')).toHaveValue('Standup prep');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});
