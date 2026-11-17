import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openAt(page: Page, dateTime: string) {
  await page.clock.install({ time: new Date(dateTime) });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });
const objective = (page: Page, title: string) => page.getByTestId('objective').filter({ has: page.locator(`input[value="${title}"]`) });

test('weekly objectives collect tasks, track time and progress, and link from any task', async ({ page }) => {
  await openAt(page, '2026-11-17T09:00:00'); // a Tuesday
  await page.keyboard.press('n');
  await expect(page).toHaveURL(/\/week$/);
  await expect(page.getByText('Nov 16 – 22')).toBeVisible();

  // On this page, A adds an objective.
  await page.keyboard.press('a');
  await expect(page.getByLabel('Add objective')).toBeFocused();
  await page.keyboard.type('Hire designer');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ship v2 pricing');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('objective')).toHaveCount(2);

  const pricing = objective(page, 'Ship v2 pricing');
  await pricing.getByLabel('Add task to Ship v2 pricing').fill('Draft the pricing page');
  await pricing.getByLabel('Add task to Ship v2 pricing').press('Enter');
  await pricing.getByLabel('Add task to Ship v2 pricing').press('Escape');
  await expect(pricing).toContainText('0/1 tasks');
  await expect(page.getByRole('region', { name: 'What remains this week' })).toContainText('Hire designer');

  // The task is on today's list, marked as part of the week, and can be timed.
  await page.keyboard.press('t');
  await expect(card(page, 'Draft the pricing page')).toContainText('This week');
  await card(page, 'Draft the pricing page').hover();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('45:00');
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.keyboard.press('t');

  // Link another task from the day with R.
  const row = page.getByLabel(/^Add task to \d/);
  await row.fill('Phone screens ~1h');
  await row.press('Enter');
  await row.press('Escape');
  await card(page, 'Phone screens').hover();
  await page.keyboard.press('r');
  await page.getByPlaceholder('Link to an objective').fill('hire');
  await expect(page.getByRole('option', { name: 'Hire designer' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(card(page, 'Phone screens')).toContainText('This week');

  await page.keyboard.press('Shift+R');
  const panel = page.getByRole('complementary', { name: 'Weekly objectives' });
  await expect(panel).toContainText('Hire designer');
  await expect(panel).toContainText('0/1 tasks done');

  await page.keyboard.press('n');
  await expect(objective(page, 'Ship v2 pricing')).toContainText('0:45 spent');
  await expect(page.getByRole('region', { name: 'Progress this week' })).toContainText('100% of the 0:45 tracked');
  await expect(page.getByRole('region', { name: 'What remains this week' })).toContainText('1:00');

  await objective(page, 'Ship v2 pricing').getByRole('checkbox', { name: 'Complete Draft the pricing page' }).click();
  await expect(objective(page, 'Ship v2 pricing')).toContainText('1/1 tasks');
  await objective(page, 'Ship v2 pricing').getByRole('checkbox', { name: 'Complete Ship v2 pricing' }).click();
  await expect(page.getByRole('region', { name: 'Progress this week' })).toContainText('1 of 2 objectives complete');
});

test('an unfinished objective can be carried into the next week', async ({ page }) => {
  await openAt(page, '2026-11-20T09:00:00');
  await page.keyboard.press('n');
  await page.getByLabel('Add objective').fill('Hire designer');
  await page.getByLabel('Add objective').press('Enter');
  await expect(page.getByTestId('objective')).toHaveCount(1);

  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByText('Nov 23 – 29')).toBeVisible();
  await expect(page.getByTestId('objective')).toHaveCount(0);
  const leftover = page.getByRole('region', { name: 'Unfinished from last week' });
  await expect(leftover).toContainText('Hire designer');
  await leftover.getByRole('button', { name: 'Carry over' }).click();
  await expect(page.getByTestId('objective')).toHaveCount(1);
  await expect(leftover).toHaveCount(0);

  await page.getByRole('button', { name: 'Back to this week' }).click();
  await expect(page.getByTestId('objective')).toHaveCount(0);
});

test('weekly planning sets objectives and records a plan; weekly review reports on the week', async ({ page }) => {
  await openAt(page, '2026-11-16T08:30:00'); // Monday
  const nav = page.getByRole('navigation', { name: 'Main' });
  const weeklyPlan = nav.getByRole('link', { name: /Plan/ }).nth(1);
  await expect(weeklyPlan).toContainText('Start');
  await weeklyPlan.click();
  await expect(page).toHaveURL(/\/weekly\/plan$/);
  await expect(page.getByText('Nov 16 – 22').first()).toBeVisible();

  await page.getByLabel('Add objective').fill('Ship v2 pricing');
  await page.getByLabel('Add objective').press('Enter');
  const add = page.getByLabel('Add task to Ship v2 pricing');
  await add.fill('Draft the pricing page');
  await add.press('Enter');
  await add.press('Escape');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('Summary')).toHaveValue(/Objectives\n- Ship v2 pricing/);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(card(page, 'Weekly planning')).toBeVisible();
  await expect(weeklyPlan.getByLabel('Done')).toBeVisible();

  // Work on the task for 50 minutes on Monday and finish it.
  await card(page, 'Draft the pricing page').hover();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward('50:00');
  await page.keyboard.press('c');
  await expect(page.getByRole('heading', { name: 'Done for the day' })).toBeVisible();

  // Friday afternoon: the review is due and covers this week.
  await page.clock.setSystemTime(new Date('2026-11-20T15:30:00'));
  await page.goto('/');
  await expect(nav).toBeVisible();
  const weeklyReview = nav.getByRole('link', { name: /Review/ });
  await expect(weeklyReview).toContainText('Start');
  await weeklyReview.click();

  await expect(page.getByRole('heading', { name: 'Week in review' })).toBeVisible();
  await expect(page.getByTestId('review-objective')).toContainText('Open');
  await expect(page.getByTestId('review-objective')).toContainText('0:50 · 1/1 tasks');
  await page.keyboard.press('ArrowRight');

  await expect(page.getByRole('heading', { name: 'What got done' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'By day' })).toContainText('Draft the pricing page');
  await expect(page.getByTestId('day-bar').first()).toContainText('0:50');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByLabel('Summary')).toHaveValue(/Finished 1 task and logged 0:50\./);
  await page.getByRole('button', { name: 'Wrap up' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(weeklyReview.getByLabel('Done')).toBeVisible();
});
