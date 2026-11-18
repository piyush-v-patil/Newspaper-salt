import type { Browser, Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

/**
 * First sign-in on a device, against the real project with a test account
 * that starts empty. Skipped unless LIVE_JOIN_EMAIL and LIVE_JOIN_PASSWORD are set.
 */
const email = process.env.LIVE_JOIN_EMAIL;
const password = process.env.LIVE_JOIN_PASSWORD;
test.skip(!email || !password, 'needs LIVE_JOIN_EMAIL and LIVE_JOIN_PASSWORD (an account with no data)');

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

async function signIn(page: Page) {
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function freshDevice(browser: Browser) {
  const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  return { context, page };
}

test('first sign-in: empty account, a set-up device, a new device, and combining two', async ({ page: laptop, browser }) => {
  test.setTimeout(240_000);

  // 1. A brand-new device signs in to the empty account: no endless "Fetching", and it can sign out.
  const first = await freshDevice(browser);
  await first.page.getByRole('button', { name: /Already use Life Of Pi/ }).click();
  await signIn(first.page);
  await expect(first.page.getByRole('status').filter({ hasText: 'Signed in as' })).toContainText('This account doesn’t have anything in it yet', { timeout: 20_000 });
  await first.page.getByRole('button', { name: 'Sign out' }).click();
  await expect(first.page.getByRole('form', { name: 'Sign in' })).toBeVisible();
  await first.context.close();

  // 2. The laptop, set up and with tasks, signs in: the blank starter data gives way, no question asked.
  await laptop.goto('/');
  await addTasks(laptop, 'Laptop task');
  await laptop.goto('/settings?section=account');
  await signIn(laptop);
  await expect(laptop.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });
  await expect(laptop.getByRole('dialog')).toHaveCount(0);

  // 3. Another new device gets it all and skips setup, with one #work channel.
  const phone = await freshDevice(browser);
  await phone.page.getByRole('button', { name: /Already use Life Of Pi/ }).click();
  await signIn(phone.page);
  await expect(phone.page).toHaveURL(/\/today$/, { timeout: 20_000 });
  await expect(card(phone.page, 'Laptop task')).toBeVisible();
  await phone.page.goto('/settings?section=channels');
  await expect(phone.page.getByTestId('channel-row').filter({ has: phone.page.locator('input[value="work"]') })).toHaveCount(1);
  await phone.context.close();

  // 4. A tablet that was set up on its own, with its own task, signs in: the choice shows both, and combining keeps both.
  const tablet = await freshDevice(browser);
  await tablet.page.getByLabel('Your name').fill('Pi');
  for (let i = 0; i < 3; i++) await tablet.page.getByRole('button', { name: /Get started|Continue/ }).click();
  await tablet.page.getByRole('button', { name: 'Skip' }).click();
  await tablet.page.getByRole('button', { name: 'Continue' }).click();
  // Leave setup for the workspace by marking it done the quick way: plan today with one task.
  await tablet.page.getByRole('button', { name: /Plan today|Plan tomorrow/ }).first().click();
  await addTasks(tablet.page, 'Tablet task');
  await tablet.page.getByRole('button', { name: 'Next' }).click();
  await tablet.page.getByRole('button', { name: 'Next' }).click();
  await tablet.page.getByRole('button', { name: 'Looks good' }).click();
  await tablet.page.getByRole('button', { name: 'Get started' }).click();
  await tablet.page.goto('/settings?section=account');
  await signIn(tablet.page);
  const dialog = tablet.page.getByRole('dialog', { name: 'This device and your account both have tasks' });
  await expect(dialog).toContainText('has 1 task. This device has 2 tasks', { timeout: 20_000 });
  await dialog.getByRole('button', { name: /Combine both/ }).click();
  await expect(tablet.page.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });
  await tablet.page.goto('/today');
  await expect(card(tablet.page, 'Laptop task')).toBeVisible({ timeout: 20_000 });
  await expect(card(tablet.page, 'Tablet task')).toBeVisible();
  await tablet.page.goto('/settings?section=channels');
  await expect(tablet.page.getByTestId('channel-row').filter({ has: tablet.page.locator('input[value="work"]') })).toHaveCount(1);
  await tablet.context.close();
});
