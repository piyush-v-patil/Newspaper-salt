import { expect, test, addTasksVia } from './fixtures';

test.use({ freshStart: true });

test('first run: setup screens lead into a guided first plan, then the workspace', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:10:00') });
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  // Nothing else is reachable until setup is done.
  await page.goto('/board');
  await expect(page).toHaveURL(/\/welcome$/);

  await expect(page.getByRole('heading', { name: 'Welcome to Life Of Pi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeDisabled();
  await page.getByLabel('Your name').fill('Piyush');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'What does a workday look like, Piyush?' })).toBeVisible();
  await page.getByLabel('Start of workday').fill('08:30');
  await page.getByLabel('End of workday').fill('17:30');
  await expect(page.getByText('Suggested for a 9:00 day: 6:30.')).toBeVisible();
  await page.getByRole('button', { name: 'Fri' }).click(); // Fridays off
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Sort your work into channels' })).toBeVisible();
  await page.getByRole('button', { name: '#deep-work' }).click();
  await page.getByRole('button', { name: '#health' }).click();

  // Leaving and coming back resumes on the same screen.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sort your work into channels' })).toBeVisible();
  await page.getByRole('button', { name: '#deep-work' }).click();
  await page.getByRole('button', { name: '#health' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Fixed commitments become repeating events.
  await expect(page.getByRole('heading', { name: 'What is fixed in your week?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
  await page.getByRole('button', { name: 'Lunch' }).click();
  await page.getByRole('button', { name: 'Add something else' }).click();
  const custom = page.getByTestId('commitment').nth(1);
  await custom.getByLabel('What').fill('Team meeting');
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Friday']) await custom.getByRole('button', { name: day, exact: true }).click();
  await custom.getByLabel('From').fill('14:00');
  await custom.getByLabel('Until').fill('15:00');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'When do you plan your day?' })).toBeVisible();
  await page.getByLabel('Planning time').fill('08:00');
  await expect(page.getByText('Morning planning: you will plan the same day.')).toBeVisible();
  await expect(page.getByText('Your day ends at 5:30 PM.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Let’s plan your first day, Piyush' })).toBeVisible();
  await page.getByRole('button', { name: /Plan today/ }).click();

  // The first plan is coached.
  await expect(page).toHaveURL(/\/plan\?date=2026-11-17$/);
  await expect(page.getByTestId('coach')).toBeVisible();
  await addTasksVia(page, page.getByLabel('Add task to 2026-11-17'), 'Write the brief ~1h #deep-work');
  await expect(page.getByTestId('task').filter({ hasText: 'Write the brief' })).toContainText('#deep-work');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByTestId('task').filter({ hasText: 'Set up Life Of Pi' })).toBeVisible();
  await expect(page.getByTestId('task').filter({ hasText: 'Write the brief' })).toBeVisible();

  // Lunch is on today's calendar, and the Thursday meeting on Thursday.
  await expect(page.getByLabel(/^Lunch, 12:00 PM – 1:00 PM$/)).toBeVisible();
  await page.goto('/today?date=2026-11-19');
  await expect(page.getByLabel(/^Team meeting, 2:00 PM – 3:00 PM$/)).toBeVisible();
  await page.goto('/today?date=2026-11-18');
  await expect(page.getByLabel(/^Team meeting/)).toHaveCount(0);

  // The answers were kept: Friday is unavailable, so the calendar shades it all.
  await page.goto('/board');
  await expect(page).toHaveURL(/\/board$/);
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/today$/);
});

test('planning tomorrow during setup also finishes it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T19:00:00') });
  await page.goto('/');
  await page.getByLabel('Your name').fill('Sam');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Get started|Continue/ }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: /Plan tomorrow/ })).toContainText('Suggested');
  await page.getByRole('button', { name: /Plan tomorrow/ }).click();
  await expect(page.getByRole('heading', { name: 'What do you want to get done tomorrow?' })).toBeVisible();

  // Exiting part-way returns to setup rather than the workspace.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/welcome$/);
});
