import { expect, test, addTasks } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  // The shell appears once stored settings and channels have loaded.
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

const addRow = (page: import('@playwright/test').Page) => page.getByLabel(/^Add task to/).first();

test('a task survives a reload, can be completed, deleted and restored', async ({ page }) => {
  await addTasks(page, 'Draft Q4 report', 'Review designs');
  await expect(page.getByTestId('task')).toHaveText(['Review designs', 'Draft Q4 report']);

  await page.reload();
  await expect(page.getByTestId('task')).toHaveCount(2);

  await page.getByRole('checkbox', { name: 'Complete Draft Q4 report' }).click();
  await expect(page.getByRole('checkbox', { name: 'Reopen Draft Q4 report' })).toBeChecked();

  await page.getByTestId('task').first().hover();
  await page.keyboard.press('Control+Backspace');
  await expect(page.getByTestId('task')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('task')).toHaveCount(2);
});

test('single keys switch views and Ctrl+Z undoes', async ({ page }) => {
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByTestId('board')).toBeVisible();
  await page.keyboard.press('o');
  await expect(page).toHaveURL(/\/shutdown$/);
  await page.keyboard.press('t');
  await expect(page).toHaveURL(/\/today$/);

  await addTasks(page, 'Temporary');
  await expect(page.getByTestId('task')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('task')).toHaveCount(0);
});

test('typing in a field does not trigger shortcuts', async ({ page }) => {
  await addRow(page).click();
  await page.getByLabel('Task title').fill('th');
  await page.getByLabel('Task title').press('h');
  await expect(page).toHaveURL(/\/today$/);
});

test('day navigation moves a day at a time and returns to today', async ({ page }) => {
  const title = page.getByRole('heading', { level: 1 });
  const todayLabel = await title.textContent();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
  await expect(title).not.toHaveText(todayLabel!);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(title).toHaveText(todayLabel!);
  await expect(page).toHaveURL(/\/today$/);
});

test('panels hide and show, and the choice is remembered', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  await page.keyboard.press('Shift+<');
  await expect(nav).toBeHidden();
  await page.reload();
  await expect(nav).toBeHidden();
  await page.getByTestId('nav-peek').hover();
  await expect(nav).toBeInViewport();
  await page.keyboard.press('Shift+<');

  await expect(page.getByRole('complementary', { name: 'Calendar' })).toBeVisible();
  await page.keyboard.press('Shift+B');
  await expect(page.getByRole('complementary', { name: 'Backlog' })).toBeVisible();
  await page.keyboard.press('Shift+>');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('Shift+L switches to dark mode and it sticks', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Shift+L');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('on a narrow window the navigation becomes a drawer and panels open over the content', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 820 });
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).not.toBeInViewport();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(nav).toBeInViewport();
  await nav.getByRole('link', { name: 'Board' }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(nav).not.toBeInViewport();

  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Calendar' });
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close panel' }).click({ position: { x: 10, y: 400 } });
  await expect(page.getByRole('complementary')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
