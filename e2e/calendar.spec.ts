import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const HOUR_PX = 52;

/** Opens the app with the clock set to a fixed time on Tuesday 17 November 2026. */
async function openAt(page: Page, time: string) {
  await page.clock.install({ time: new Date(`2026-11-17T${time}:00`) });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });
const sessions = (page: Page) => page.getByTestId('session');

async function quickAdd(page: Page, ...titles: string[]) {
  const row = page.getByLabel(/^Add task to/).first();
  for (const title of titles) {
    await row.fill(title);
    await row.press('Enter');
  }
  await row.press('Escape');
}

/** Screen position of a time of day in the first calendar column. */
async function pointAt(page: Page, hours: number, minutes = 0) {
  const column = page.locator('[data-cal-day]').first();
  const box = (await column.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + ((hours * 60 + minutes) * HOUR_PX) / 60 };
}

async function dragMouse(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 3, from.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

test('X books the next free time, the card shows it, and Ctrl+X takes it off again', async ({ page }) => {
  await openAt(page, '08:00');
  await quickAdd(page, 'Draft report ~1h30');
  await card(page, 'Draft report').hover();
  await page.keyboard.press('x');
  await expect(sessions(page)).toHaveAccessibleName('Draft report, 09:00 – 10:30');
  await expect(card(page, 'Draft report')).toContainText('09:00');

  // A second task goes straight after the first.
  await quickAdd(page, 'Review designs ~45');
  await card(page, 'Review designs').hover();
  await page.keyboard.press('x');
  await expect(page.getByLabel('Review designs, 10:30 – 11:15')).toBeVisible();

  await page.keyboard.press('Control+x');
  await expect(sessions(page)).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(sessions(page)).toHaveCount(2);
});

test('a task dragged onto the calendar becomes a session at that time', async ({ page }) => {
  await openAt(page, '08:00');
  await quickAdd(page, 'Call supplier');
  const from = (await card(page, 'Call supplier').boundingBox())!;
  const to = await pointAt(page, 11, 10);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 8, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(page.getByTestId('calendar-ghost')).toHaveText('11:00');
  await page.mouse.up();

  await expect(sessions(page)).toHaveAccessibleName('Call supplier, 11:00 – 11:30');
  // With no estimate it took the default half hour, which is now its planned time.
  await expect(card(page, 'Call supplier')).toContainText('0:30');
  // The card is still in the list.
  await expect(page.getByTestId('task')).toHaveCount(1);
});

test('moving and resizing a session keeps the planned time in step', async ({ page }) => {
  await openAt(page, '08:00');
  await quickAdd(page, 'Write summary ~30');
  await card(page, 'Write summary').hover();
  await page.keyboard.press('x');
  await expect(sessions(page)).toHaveAccessibleName('Write summary, 09:00 – 09:30');

  // Drag the bottom edge down by half an hour.
  const box = (await sessions(page).boundingBox())!;
  await dragMouse(page, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + box.width / 2, y: box.y + box.height - 2 + HOUR_PX / 2 });
  await expect(sessions(page)).toHaveAccessibleName('Write summary, 09:00 – 10:00');
  await expect(card(page, 'Write summary')).toContainText('1:00');

  // Drag the whole block down by an hour.
  const moved = (await sessions(page).boundingBox())!;
  await dragMouse(page, { x: moved.x + moved.width / 2, y: moved.y + 20 }, { x: moved.x + moved.width / 2, y: moved.y + 20 + HOUR_PX });
  await expect(sessions(page)).toHaveAccessibleName('Write summary, 10:00 – 11:00');
  await expect(card(page, 'Write summary')).toContainText('10:00');

  // Clicking a session opens its task.
  await sessions(page).click({ position: { x: 60, y: 30 } });
  await expect(page.getByRole('dialog').getByLabel('Task title')).toHaveValue('Write summary');
});

test('an event is drawn on the grid, named, and auto-scheduling works around it', async ({ page }) => {
  await openAt(page, '08:00');
  await dragMouse(page, await pointAt(page, 9, 2), await pointAt(page, 10, 0));
  const title = page.getByLabel('Event title');
  await expect(title).toBeFocused();
  await title.fill('Standup');
  await title.press('Enter');
  await expect(page.getByTestId('event')).toHaveAccessibleName('Standup, 09:00 – 10:00');

  await quickAdd(page, 'Deep work ~1h');
  await card(page, 'Deep work').hover();
  await page.keyboard.press('x');
  await expect(sessions(page)).toHaveAccessibleName('Deep work, 10:00 – 11:00');

  await page.getByTestId('event').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('event')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('event')).toHaveCount(1);
});

test('when the working day is over, X offers what to do instead', async ({ page }) => {
  await openAt(page, '18:20');
  await quickAdd(page, 'Late idea ~30', 'Another ~30');

  await card(page, 'Late idea').hover();
  await page.keyboard.press('x');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('No free time that day');
  await dialog.getByRole('button', { name: /Schedule anyway/ }).click();
  await expect(sessions(page)).toHaveAccessibleName('Late idea, 18:20 – 18:50');

  await card(page, 'Another').hover();
  await page.keyboard.press('x');
  await page.getByRole('dialog').getByRole('button', { name: /Defer/ }).click();
  await expect(page.getByTestId('task')).toHaveCount(1);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(card(page, 'Another')).toBeVisible();
});

test('the workload counter warns as the day fills past the threshold', async ({ page }) => {
  await openAt(page, '08:00');
  const counter = page.getByTestId('workload').first();
  await quickAdd(page, 'One ~2h #work');
  await expect(counter).toHaveAttribute('data-level', 'ok');
  await expect(counter).toContainText('2:00 left');

  await quickAdd(page, 'Two ~3h #work');
  await expect(counter).toHaveAttribute('data-level', 'near');

  await quickAdd(page, 'Three ~1h #work');
  await expect(counter).toHaveAttribute('data-level', 'over');
  await expect(counter).toContainText('over by 0:30');

  // Personal tasks do not count toward the threshold.
  await quickAdd(page, 'Gym ~1h #personal');
  await expect(counter).toContainText('7:00 left · over by 0:30');
  await counter.click();
  await expect(counter).toContainText('6:00 work left');
});

test('the calendar view shows the week with the day’s tasks beside it', async ({ page }) => {
  await openAt(page, '08:00');
  await quickAdd(page, 'Plan sprint ~1h');
  await page.keyboard.press('j');
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.locator('[data-cal-day]')).toHaveCount(7);
  await expect(page.getByRole('complementary', { name: 'Tasks' })).toBeVisible();
  await expect(card(page, 'Plan sprint')).toBeVisible();

  // Drag from the task panel onto Thursday at 14:00.
  const thursday = page.locator('[data-cal-day="2026-11-19"]');
  const column = (await thursday.boundingBox())!;
  const from = (await card(page, 'Plan sprint').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 12, from.y + from.height / 2 + 8, { steps: 3 });
  await page.mouse.move(column.x + column.width / 2, column.y + (14 * 60 + 10) * (HOUR_PX / 60), { steps: 12 });
  await page.mouse.up();
  await expect(thursday.getByTestId('session')).toHaveAccessibleName('Plan sprint, 14:00 – 15:00');
  // The task now belongs to Thursday, so it has left today's panel.
  await expect(page.getByTestId('task')).toHaveCount(0);

  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.locator('[data-cal-day]')).toHaveCount(1);
});
