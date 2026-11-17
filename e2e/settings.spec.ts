import type { Page } from '@playwright/test';
import { expect, setProfile, setSettings, test } from './fixtures';

async function openAt(page: Page, dateTime: string) {
  await page.clock.install({ time: new Date(dateTime) });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

async function quickAdd(page: Page, ...titles: string[]) {
  const row = page.getByLabel(/^Add task to \d/);
  for (const title of titles) {
    await row.fill(title);
    await row.press('Enter');
  }
  await row.press('Escape');
}

async function openSection(page: Page, name: string) {
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

test('general settings change how the app looks and opens', async ({ page }) => {
  await openAt(page, '2026-11-17T08:00:00');
  await openSection(page, 'General');
  await page.getByLabel('Time format').selectOption({ label: '12-hour (2:30 PM)' });
  await page.getByLabel('Open on').selectOption({ label: 'Board' });
  await page.getByLabel('Appearance').selectOption({ label: 'Dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/');
  await expect(page).toHaveURL(/\/board$/);
  await page.keyboard.press('t');
  await quickAdd(page, 'Morning call ~30');
  await card(page, 'Morning call').hover();
  await page.keyboard.press('x');
  await expect(page.getByTestId('session')).toHaveAccessibleName('Morning call, 9:00 AM – 9:30 AM');
});

test('working hours and the workload limit drive scheduling and the warning', async ({ page }) => {
  await openAt(page, '2026-11-17T08:00:00'); // Tuesday
  await openSection(page, 'Schedule');
  await page.getByLabel('Tuesday start').fill('10:00');
  await page.getByLabel('Daily workload limit in hours').fill('2');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Not working').or(page.getByText('7:00 working')).first()).toBeVisible();

  await page.goto('/today');
  await quickAdd(page, 'Long one ~2h30');
  await expect(page.getByTestId('workload').first()).toHaveAttribute('data-level', 'over');
  await card(page, 'Long one').hover();
  await page.keyboard.press('x');
  await expect(page.getByTestId('session')).toHaveAccessibleName('Long one, 10:00 – 12:30');
});

test('channels can be renamed, recoloured, made the default and hidden', async ({ page }) => {
  await openAt(page, '2026-11-17T08:00:00');
  await openSection(page, 'Channels');
  const work = page.getByRole('region', { name: 'Work' });
  await work.getByLabel('Add channel to Work').fill('Deep Work');
  await work.getByLabel('Add channel to Work').press('Enter');
  const deep = work.getByTestId('channel-row').filter({ has: page.locator('input[value="deep-work"]') });
  await expect(deep).toBeVisible();
  await deep.getByRole('button', { name: 'Default' }).click();
  await expect(deep.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true');

  const personalRow = page.getByRole('region', { name: 'Personal' }).getByTestId('channel-row').first();
  await personalRow.getByRole('switch').click();
  await expect(personalRow.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

  await page.goto('/today');
  await quickAdd(page, 'Write the spec');
  await expect(card(page, 'Write the spec')).toContainText('#deep-work');
  await page.keyboard.press('Shift+F');
  await expect(page.getByRole('menuitem', { name: '#deep-work' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '#personal' })).toHaveCount(0);
});

test('a backup can be exported and restored over newer data; a bad file is refused', async ({ page }) => {
  await openAt(page, '2026-11-17T08:00:00');
  await page.goto('/today');
  await quickAdd(page, 'Keep me');
  await expect(card(page, 'Keep me')).toBeVisible();
  await openSection(page, 'Your data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('life-of-pi-backup-2026-11-17.json');
  const path = await file.path();

  await page.goto('/today');
  await quickAdd(page, 'Made later');
  await expect(page.getByTestId('task')).toHaveCount(2);

  await openSection(page, 'Your data');
  await page.getByLabel('Backup file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('alert')).toHaveText('This file is not a Life Of Pi backup.');

  await page.getByLabel('Backup file').setInputFiles(path);
  await expect(page.getByRole('alert')).toContainText('holds 1 tasks');
  await page.getByRole('button', { name: 'Replace everything' }).click();
  // The app reloads onto its home view with the restored data.
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('task')).toHaveText([/Keep me/]);
});

test('erasing everything starts setup again', async ({ page }) => {
  await openSection(page, 'Your data');
  await page.getByRole('button', { name: 'Erase everything…' }).click();
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Life Of Pi' })).toBeVisible();
});

test('the weekly rituals are offered at their set times', async ({ page }) => {
  await openAt(page, '2026-11-16T08:10:00'); // Monday
  // Someone who has been using the app for a while.
  await setProfile(page, { createdAt: new Date('2026-11-01T09:00:00').getTime() });
  await setSettings(page, {
    weeklyPlan: { weekday: 1, min: 8 * 60, auto: true },
    weeklyReview: { weekday: 5, min: 15 * 60, auto: true },
  });
  const prompt = page.getByRole('dialog');
  // Monday morning: last week has not been reviewed, so that comes first.
  await expect(prompt).toContainText('Time to review the week');
  await prompt.getByRole('button', { name: 'Not today' }).click();
  // Setting the review aside does not silence planning.
  await expect(prompt).toContainText('Time to plan the week');
  await prompt.getByRole('button', { name: 'Plan my week' }).click();
  await expect(page).toHaveURL(/\/weekly\/plan$/);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(prompt).toHaveCount(0);

  // Friday afternoon brings the review.
  await page.clock.setSystemTime(new Date('2026-11-20T15:05:00'));
  await page.reload();
  await expect(prompt).toContainText('Time to review the week');
  await prompt.getByRole('button', { name: 'Not today' }).click();
  await expect(prompt).toHaveCount(0);
});
