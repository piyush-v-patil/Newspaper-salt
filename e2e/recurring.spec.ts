import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('a task can be made to repeat, edited across the series, and stopped', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') }); // a Tuesday
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  await addTasks(page, 'Stand-up notes ~15');

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
  // Thursday's copy is renamed too; wait until today's list is the one showing.
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('task')).toHaveCount(1);
  await expect(card(page, 'Daily notes')).toBeVisible();

  // Stop the series: today's stays, Thursday's goes.
  await card(page, 'Daily notes').getByText('Daily notes').click();
  await expect(page.getByRole('dialog').first().getByLabel('Task title')).toHaveValue('Daily notes');
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

test('a repeating task can go on the calendar at roughly a time, and how often it repeats can be changed', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T06:00:00') }); // a Tuesday
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'Gym ~1h');

  await card(page, 'Gym').click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Repeat…' }).click();
  const repeat = page.getByRole('dialog', { name: 'Repeat this task' });
  await repeat.getByRole('checkbox', { name: 'At roughly' }).check();
  await repeat.getByLabel('At roughly', { exact: true }).last().fill('07:00');
  await expect(repeat).toContainText('Every day at about 07:00');
  await repeat.getByRole('button', { name: 'Repeat', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(page.getByTestId('session')).toHaveAccessibleName('Gym, 07:00 – 08:00');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('session')).toHaveAccessibleName('Gym, 07:00 – 08:00');
  await page.keyboard.press('Shift+ArrowLeft');

  // Now only on weekdays, at 6:30.
  await card(page, 'Gym').getByText('Gym').click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Repeating…' }).click();
  const existing = page.getByRole('dialog', { name: 'Repeating task' });
  await existing.getByRole('button', { name: /Change how often/ }).click();
  await existing.getByRole('radio', { name: 'Weekdays' }).click();
  await existing.getByLabel('At roughly', { exact: true }).last().fill('06:30');
  await existing.getByRole('button', { name: 'Change', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(page.getByTestId('session')).toHaveAccessibleName('Gym, 06:30 – 07:30');
  // Saturday 21st has none now; Monday 23rd does.
  await page.goto('/today?date=2026-11-21');
  await expect(page.getByTestId('task')).toHaveCount(0);
  await page.goto('/today?date=2026-11-23');
  await expect(page.getByTestId('session')).toHaveAccessibleName('Gym, 06:30 – 07:30');
});
