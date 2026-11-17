import type { Page } from '@playwright/test';
import { expect, setSettings, test } from './fixtures';

async function openAt(page: Page, dateTime: string) {
  await page.clock.install({ time: new Date(dateTime) });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Jumps the clock to a new date and time and reloads, as if the app were reopened then. */
async function reopenAt(page: Page, dateTime: string) {
  await page.clock.setSystemTime(new Date(dateTime));
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

const tasks = (page: Page) => page.getByTestId('task');
const card = (page: Page, title: string) => tasks(page).filter({ hasText: title });
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

async function quickAdd(page: Page, ...titles: string[]) {
  const row = page.getByLabel(/^Add task to/).first();
  for (const title of titles) {
    await row.fill(title);
    await row.press('Enter');
  }
  await row.press('Escape');
}

test('unfinished tasks roll over at midnight while the app is open, with a count', async ({ page }) => {
  await openAt(page, '2026-11-17T22:00:00');
  await quickAdd(page, 'Finished today', 'Left undone');
  await page.getByRole('checkbox', { name: 'Complete Finished today' }).click();
  await expect(page.getByRole('checkbox', { name: 'Reopen Finished today' })).toBeChecked();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tuesday, November 17');

  await page.clock.fastForward('02:30:00');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wednesday, November 18');
  await expect(tasks(page)).toHaveText([/Left undone/]);
  await expect(card(page, 'Left undone').getByTitle('Rolled over 1 day in a row')).toHaveText('1');

  // The finished task stays on the day it was done.
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(tasks(page)).toHaveText([/Finished today/]);
});

test('a task that keeps rolling over is archived, announced, and can be brought back', async ({ page }) => {
  await openAt(page, '2026-11-17T10:00:00');
  await quickAdd(page, 'Never quite done');
  await reopenAt(page, '2026-11-21T09:00:00');
  await expect(card(page, 'Never quite done').getByTitle('Rolled over 4 days in a row')).toBeVisible();

  await reopenAt(page, '2026-11-22T09:00:00');
  await expect(tasks(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toContainText('1');
  await page.getByRole('button', { name: '1 task moved to archive' }).click();

  const archive = page.getByRole('complementary', { name: 'Archive' });
  await expect(archive.getByTestId('panel-task')).toContainText('Never quite done');
  await archive.getByTestId('panel-task').hover();
  await archive.getByRole('button', { name: 'Move Never quite done to today' }).click();
  await expect(card(page, 'Never quite done')).toBeVisible();
  await expect(archive.getByTestId('panel-task')).toHaveCount(0);
});

test('deleted tasks wait in the trash and can be restored; search finds tasks on any day', async ({ page }) => {
  await openAt(page, '2026-11-17T10:00:00');
  await quickAdd(page, 'Renew passport', 'Buy stamps');
  await card(page, 'Buy stamps').hover();
  await page.keyboard.press('Control+Backspace');
  await expect(tasks(page)).toHaveCount(1);

  await page.getByRole('button', { name: 'Trash' }).click();
  const trash = page.getByRole('complementary', { name: 'Trash' });
  await trash.getByTestId('panel-task').hover();
  await trash.getByRole('button', { name: 'Restore Buy stamps' }).click();
  await expect(tasks(page)).toHaveCount(2);

  await card(page, 'Renew passport').hover();
  await page.keyboard.press('d');
  await expect(tasks(page)).toHaveCount(1);
  await page.keyboard.press('Control+f');
  await page.getByLabel('Search tasks').fill('passp');
  const result = page.getByTestId('search-result');
  await expect(result).toContainText('Renew passport');
  await expect(result).toContainText('Tomorrow');
  await result.click();
  await expect(page.getByRole('dialog').getByLabel('Task title')).toHaveValue('Renew passport');
});

test('daily planning walks from a look back to a finished plan', async ({ page }) => {
  await openAt(page, '2026-11-17T14:00:00');
  await quickAdd(page, 'Carried task ~1h', 'Done yesterday ~30');
  await page.getByRole('checkbox', { name: 'Complete Done yesterday' }).click();
  // Wait until the completion is saved before moving the clock on.
  await expect(page.getByRole('checkbox', { name: 'Reopen Done yesterday' })).toBeChecked();
  await reopenAt(page, '2026-11-18T08:45:00');

  await page.keyboard.press('p');
  await expect(page).toHaveURL(/\/plan$/);
  await expect(nav(page)).toBeHidden();

  // Step 0: yesterday was never shut down, so planning opens with a look back.
  await expect(page.getByRole('heading', { name: 'How did yesterday go?' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Finished' })).toContainText('Done yesterday');
  await expect(page.getByRole('region', { name: 'Carried over' })).toContainText('Carried task');
  await page.keyboard.press('ArrowRight');

  // Step 1: add tasks, and pull one in from the backlog.
  await expect(page.getByRole('heading', { name: 'What do you want to get done today?' })).toBeVisible();
  await page.getByLabel('Add task to backlog').fill('From the backlog ~45');
  await page.getByLabel('Add task to backlog').press('Enter');
  await page.getByLabel('Add task to 2026-11-18').fill('Big new thing ~5h');
  await page.getByLabel('Add task to 2026-11-18').press('Enter');
  await page.getByLabel('Add task to 2026-11-18').press('Escape');
  await card(page, 'From the backlog').hover();
  await page.keyboard.press('s');
  await expect(page.getByRole('region', { name: 'Today' }).getByTestId('task')).toHaveCount(3);
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2: over the threshold, so something has to wait.
  await expect(page.getByRole('heading', { name: 'What can wait?' })).toBeVisible();
  const counter = page.getByTestId('workload');
  await expect(counter).toHaveAttribute('data-level', 'over');
  await expect(counter).toContainText('over by 1:15');
  await card(page, 'Carried task').hover();
  await page.keyboard.press('d');
  await expect(page.getByRole('region', { name: 'Tomorrow' })).toContainText('Carried task');
  // Still a little over: the plan can go ahead anyway, with the warning in view.
  await expect(counter).toContainText('over by 0:15');

  // Leaving and coming back resumes on the same step.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/today$/);
  await expect(nav(page).getByRole('link', { name: /Plan/ }).first()).toContainText('Start');
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'What can wait?' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: order, timebox, set the shutdown time.
  await expect(page.getByRole('heading', { name: 'Finalize your plan' })).toBeVisible();
  await card(page, 'From the backlog').hover();
  await page.keyboard.press('x');
  await expect(page.getByTestId('session')).toHaveAccessibleName('From the backlog, 09:00 – 09:45');
  await page.getByLabel('Shutdown time').fill('16:30');
  await page.getByRole('button', { name: 'Looks good' }).click();

  // Step 4: the plan, read back.
  await expect(page.getByRole('heading', { name: 'Your plan for today' })).toBeVisible();
  await expect(page.getByText('Total planned 5:45 · stopping at 16:30')).toBeVisible();
  await page.getByLabel('Obstacles').fill('Design files may arrive late');
  await page.getByRole('button', { name: 'Get started' }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('celebration')).toBeVisible();
  await expect(card(page, 'Daily planning')).toBeVisible();
  await expect(nav(page).getByRole('link', { name: /Plan/ }).first().getByLabel('Done')).toBeVisible();
});

test('daily shutdown reviews the day, keeps the highlights, and files them', async ({ page }) => {
  await openAt(page, '2026-11-17T09:00:00');
  await quickAdd(page, 'Untouched ~30', 'Half done ~1h', 'Shipped release ~1h #work');
  await card(page, 'Shipped release').hover();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('50:00');
  await page.keyboard.press('c');
  // Focus moved to the next task, with the timer still running.
  await expect(page.getByLabel('Task title')).toHaveValue('Half done');
  await page.clock.fastForward('20:00');
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

  await page.clock.setSystemTime(new Date('2026-11-17T17:10:00'));
  await page.keyboard.press('o');
  await expect(page).toHaveURL(/\/shutdown$/);
  await expect(page.getByRole('heading', { name: 'Today in review' })).toBeVisible();
  await expect(page.getByText('1:10', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Worked on' })).toContainText('Shipped release0:50 / 1:00');
  await expect(page.getByRole('region', { name: 'Worked on' })).toContainText('Half done0:20 / 1:00');
  await expect(page.getByRole('region', { name: 'Didn’t get to' })).toContainText('Untouched');
  await page.getByRole('button', { name: 'Next' }).click();

  // Finished tasks start as highlights; work in progress can be included.
  await expect(page.getByTestId('highlight')).toHaveText([/Shipped release/]);
  await page.getByRole('button', { name: 'Include' }).click();
  await expect(page.getByTestId('highlight')).toHaveCount(2);
  await page.getByTestId('highlight').filter({ hasText: 'Half done' }).hover();
  await page.getByRole('button', { name: 'Remove Half done from highlights' }).click();
  await page.getByRole('radio', { name: 'Mood 🙂' }).click();
  await page.getByRole('textbox', { name: 'Reflection' }).fill('Today was steady. The release went out a day early.');
  await page.getByRole('button', { name: 'Done for the day' }).click();

  await expect(page.getByRole('heading', { name: 'Shutdown complete' })).toBeVisible();
  await expect(page.getByTestId('celebration')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(nav(page).getByRole('link', { name: /Shutdown/ }).getByLabel('Done')).toBeVisible();
  // Shutdown does not move unfinished work.
  await expect(card(page, 'Untouched')).toBeVisible();

  await nav(page).getByRole('link', { name: 'Highlights' }).click();
  const day = page.getByTestId('highlight-day');
  await expect(day).toContainText('Tuesday, November 17');
  await expect(day).toContainText('🙂');
  await expect(day).toContainText('Shipped release');
  await expect(day).not.toContainText('Half done');
  await expect(day).toContainText('The release went out a day early.');
});

test('the rituals are offered when their time comes', async ({ page }) => {
  await openAt(page, '2026-11-17T08:45:00');
  await setSettings(page, { autoPlanning: true, autoShutdown: true });
  const prompt = page.getByRole('dialog');
  await expect(prompt).toContainText('Good morning, Pi. Ready to plan?');
  await prompt.getByRole('button', { name: 'Later' }).click();
  await expect(prompt).toHaveCount(0);

  // An hour later it asks again; this time, skip for today.
  await page.clock.fastForward('01:00:30');
  await expect(prompt).toContainText('Ready to plan?');
  await prompt.getByRole('button', { name: 'Skip today' }).click();
  await page.clock.fastForward('02:00:00');
  await expect(prompt).toHaveCount(0);

  // A running timer is never interrupted.
  await quickAdd(page, 'Deep work');
  await card(page, 'Deep work').hover();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('t');
  await page.clock.setSystemTime(new Date('2026-11-17T17:05:00'));
  await page.clock.fastForward('00:30');
  await expect(prompt).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(prompt).toContainText('Time to shut down');
  await prompt.getByRole('button', { name: 'Start shutdown' }).click();
  await expect(page).toHaveURL(/\/shutdown$/);
});

test('an evening planner plans tomorrow', async ({ page }) => {
  await openAt(page, '2026-11-17T18:00:00');
  await setSettings(page, { planningMin: 18 * 60 });
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'What do you want to get done tomorrow?' })).toBeVisible();
  await expect(page.getByText('Wednesday, November 18')).toBeVisible();
});
