import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  // The shell appears once stored settings and channels have loaded.
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

const tasks = (page: Page) => page.getByTestId('task');
const card = (page: Page, title: string) => tasks(page).filter({ hasText: title });

async function quickAdd(page: Page, ...titles: string[]) {
  const row = page.getByLabel(/^Add task to/).first();
  for (const title of titles) {
    await row.fill(title);
    await row.press('Enter');
  }
  await row.press('Escape');
}

test('the add window applies typing shortcuts as you type', async ({ page }) => {
  await page.keyboard.press('a');
  const title = page.getByLabel('Task title');
  await expect(title).toBeFocused();

  await page.keyboard.type('Draft report ~45');
  await expect(page.getByRole('option', { name: /45 min/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(title).toHaveValue('Draft report ');
  await expect(page.getByRole('button', { name: 'Planned time' })).toHaveText('0:45');

  await page.keyboard.type('#wo');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Channel' })).toHaveText('work');

  await page.keyboard.type('!ur');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Priority' })).toHaveText('Urgent');

  await page.keyboard.type('@tom');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Date' })).toHaveText('Tomorrow');
  await expect(title).toHaveValue('Draft report ');

  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // It was dated tomorrow, so it is not on today's list.
  await expect(tasks(page)).toHaveCount(0);
  await page.keyboard.press('Shift+ArrowRight');
  const created = card(page, 'Draft report');
  await expect(created).toContainText('0:45');
  await expect(created).toContainText('#work');
  await expect(created.getByLabel('Urgent')).toBeVisible();
});

test('typing straight on after picking a shortcut keeps the text in order', async ({ page }) => {
  await page.keyboard.press('a');
  await page.keyboard.type('Prep workshop @tom');
  await page.keyboard.press('Enter');
  await page.keyboard.type('for Friday #wo');
  await page.keyboard.press('Enter');
  await page.keyboard.type('slides');
  await expect(page.getByLabel('Task title')).toHaveValue('Prep workshop for Friday slides');
  await expect(page.getByRole('button', { name: 'Channel' })).toHaveText('work');
});

test('a new channel can be created from the add window, and Escape only closes the menu', async ({ page }) => {
  await page.keyboard.press('a');
  await page.keyboard.type('Read paper #research');
  await expect(page.getByRole('option', { name: 'Create #research' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.getByLabel('Task title')).toBeVisible();
  // Left in the title, the shortcut is still applied on save.
  await page.keyboard.press('Enter');
  await expect(card(page, 'Read paper')).toContainText('#research');
  await expect(card(page, 'Read paper')).not.toContainText('Read paper #research');
});

test('inline add reads shortcuts and keeps ordinary punctuation', async ({ page }) => {
  await quickAdd(page, 'Fix issue #42 now! ~1h30');
  await expect(card(page, 'Fix issue #42 now!')).toContainText('1:30');
});

test('the task page edits title, subtasks and notes, and they persist', async ({ page }) => {
  await quickAdd(page, 'Draft Q4 report');
  await card(page, 'Draft Q4 report').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/task=/);

  await dialog.getByLabel('Task title').fill('Draft Q4 board report');
  await dialog.getByLabel('Task title').press('Enter');

  const add = dialog.getByLabel('Add subtask');
  await add.fill('Pull revenue numbers');
  await add.press('Enter');
  await add.fill('Outline sections');
  await add.press('Enter');
  await dialog.getByRole('checkbox', { name: 'Complete Outline sections' }).click();

  await dialog.getByRole('textbox', { name: 'Notes' }).click();
  await page.keyboard.type('Use the September figures.');
  await dialog.getByRole('button', { name: 'Planned time' }).click();
  // Wait for the picker itself; typing before it has focus would go nowhere.
  await page.getByPlaceholder('e.g. 45 or 1h30').fill('2h');
  await page.keyboard.press('Enter');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/task=/);

  const updated = card(page, 'Draft Q4 board report');
  await expect(updated).toContainText('Pull revenue numbers');
  await expect(updated).toContainText('2:00');
  await expect(updated.getByRole('checkbox', { name: 'Reopen Outline sections' })).toBeChecked();

  await page.reload();
  await card(page, 'Draft Q4 board report').click();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Notes' })).toContainText('Use the September figures.');

  // Duplicate, then delete the original from the menu.
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tasks(page)).toHaveCount(1);
});

test('shortcuts act on the hovered task', async ({ page }) => {
  await quickAdd(page, 'third', 'second', 'first');
  await expect(tasks(page)).toHaveText(['first', 'second', 'third']);

  await card(page, 'second').hover();
  await page.keyboard.press('c');
  await expect(page.getByRole('checkbox', { name: 'Reopen second' })).toBeChecked();

  await page.keyboard.press('w');
  await page.keyboard.type('30');
  await page.keyboard.press('Enter');
  await expect(card(page, 'second')).toContainText('0:30');

  await page.keyboard.press('q');
  await page.keyboard.type('pers');
  await page.keyboard.press('Enter');
  await expect(card(page, 'second')).toContainText('#personal');

  await card(page, 'second').hover();
  await page.keyboard.press('Control+ArrowDown');
  await expect(tasks(page)).toHaveText([/first/, /third/, /second/]);
  await page.keyboard.press('Control+Shift+ArrowUp');
  await expect(tasks(page)).toHaveText([/second/, /first/, /third/]);

  // Snooze sends it to tomorrow.
  await page.keyboard.press('d');
  await expect(tasks(page)).toHaveCount(2);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(card(page, 'second')).toBeVisible();
});

test('arrow keys select tasks and V opens the task page on subtasks', async ({ page }) => {
  await quickAdd(page, 'b', 'a');
  await expect(tasks(page)).toHaveText(['a', 'b']);
  await page.mouse.move(5, 300);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('v');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Task title')).toHaveValue('b');
  await expect(dialog.getByLabel('Add subtask')).toBeFocused();
});

test('the filter narrows the view and new tasks join the filtered channel', async ({ page }) => {
  await quickAdd(page, 'Buy milk #personal', 'Ship release #work');
  await page.keyboard.press('Shift+F');
  await page.getByRole('menuitem', { name: '#work' }).click();
  await expect(tasks(page)).toHaveText([/Ship release/]);

  await quickAdd(page, 'Write changelog');
  await expect(card(page, 'Write changelog')).toContainText('#work');

  await page.getByRole('button', { name: 'Clear filter' }).click();
  await expect(tasks(page)).toHaveCount(3);
});

test('the board drags a task to another day and reorders within a day', async ({ page }) => {
  await quickAdd(page, 'bottom', 'top');
  await page.keyboard.press('h');
  const board = page.getByTestId('board');
  await expect(board).toBeVisible();
  const columns = board.locator('section[data-day]');
  const day = await columns.filter({ has: page.getByText('top', { exact: true }) }).getAttribute('data-day');
  const todayColumn = board.locator(`section[data-day="${day}"]`);
  await expect(todayColumn.getByTestId('task')).toHaveText(['top', 'bottom']);
  const next = new Date(`${day}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const tomorrow = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  const tomorrowColumn = board.locator(`section[data-day="${tomorrow}"]`);

  async function drag(from: ReturnType<typeof card>, toX: number, toY: number) {
    const box = (await from.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 3 });
    await page.mouse.move(toX, toY, { steps: 12 });
    await page.mouse.up();
    // Let the dropped card finish settling into place before the next drag.
    await page.waitForTimeout(350);
  }

  // Reorder: drag "top" below "bottom".
  const bottomBox = (await card(page, 'bottom').boundingBox())!;
  await drag(card(page, 'top'), bottomBox.x + bottomBox.width / 2, bottomBox.y + bottomBox.height + 6);
  await expect(todayColumn.getByTestId('task')).toHaveText(['bottom', 'top']);

  // Move: drag "top" into tomorrow's column.
  const target = (await tomorrowColumn.boundingBox())!;
  await drag(card(page, 'top'), target.x + target.width / 2, target.y + 140);
  await expect(tomorrowColumn.getByTestId('task')).toHaveText(['top']);
  await expect(todayColumn.getByTestId('task')).toHaveText(['bottom']);

  await page.reload();
  await expect(page.getByTestId('board').locator(`section[data-day="${tomorrow}"]`).getByTestId('task')).toHaveText(['top']);
});
