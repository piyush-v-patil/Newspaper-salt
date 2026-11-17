import type { Page } from '@playwright/test';
import { expect, test, addTasks, addTasksVia } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

test('the backlog groups tasks by time bucket, with folders and its own priority', async ({ page }) => {
  // Tall enough to see every bucket at once, so a card can be dragged between them.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.keyboard.press('b');
  await expect(page).toHaveURL(/\/backlog$/);

  await addTasksVia(page, page.getByLabel('Add task to backlog'), 'Renew passport', 'Learn to sail');
  const someday = page.getByRole('region', { name: 'Someday' });
  await expect(someday.getByTestId('task')).toHaveCount(2);

  // Drag one into "Next month".
  const nextMonth = page.getByRole('region', { name: 'Next month' });
  const from = (await card(page, 'Renew passport').boundingBox())!;
  const to = (await nextMonth.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 12, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 12, { steps: 12 });
  await page.mouse.up();
  // Let the dropped card finish settling before pointing at it again.
  await page.waitForTimeout(350);
  await expect(nextMonth.getByTestId('task')).toHaveText([/Renew passport/]);
  await expect(someday.getByTestId('task')).toHaveCount(1);

  // Backlog priority, and the priority filter.
  await card(page, 'Renew passport').hover();
  await page.keyboard.press('!');
  await page.getByPlaceholder('Set backlog priority').fill('hi');
  await page.keyboard.press('Enter');
  // A hovered card shows quick actions; away from it, the priority shows as a pill.
  await page.mouse.move(0, 0);
  await expect(card(page, 'Renew passport').getByLabel('High')).toBeVisible();
  await page.getByLabel('Filter by priority').selectOption('high');
  await expect(page.getByTestId('task')).toHaveCount(1);
  await page.getByLabel('Filter by priority').selectOption('any');

  // A folder: tasks added while it is selected join it.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('New folder name').fill('Boat');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Boat', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('task')).toHaveCount(0);
  await addTasksVia(page, page.getByLabel('Add task to backlog'), 'Compare marinas');
  await expect(page.getByTestId('task')).toHaveText([/Compare marinas/]);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByTestId('task')).toHaveCount(3);

  await page.reload();
  await expect(page.getByRole('region', { name: 'Next month' }).getByTestId('task')).toHaveText([/Renew passport/]);
});

test('the backlog panel sits beside the day, and tasks move both ways', async ({ page }) => {
  await addTasks(page, 'Not today after all');

  await page.keyboard.press('Shift+B');
  const panel = page.getByRole('complementary', { name: 'Backlog' });
  await expect(panel).toBeVisible();
  await card(page, 'Not today after all').hover();
  await page.keyboard.press('z');
  await expect(panel.getByTestId('task')).toHaveText([/Not today after all/]);

  // S brings it back to today.
  await panel.getByTestId('task').hover();
  await page.keyboard.press('s');
  await expect(panel.getByTestId('task')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tasks' }).getByTestId('task')).toHaveText([/Not today after all/]);
});
