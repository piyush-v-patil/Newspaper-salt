import type { Page } from '@playwright/test';
import { expect, test, addTasks } from './fixtures';

/**
 * Against the real Supabase project, with a test account. Skipped unless
 * LIVE_SYNC_EMAIL and LIVE_SYNC_PASSWORD are set, so ordinary runs never
 * touch the server.
 */
const email = process.env.LIVE_SYNC_EMAIL;
const password = process.env.LIVE_SYNC_PASSWORD;
test.skip(!email || !password, 'needs LIVE_SYNC_EMAIL and LIVE_SYNC_PASSWORD');

const card = (page: Page, title: string) => page.getByTestId('task').filter({ hasText: title });

async function signIn(page: Page) {
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('two devices signed in to one account share their tasks', async ({ page: laptop, browser }) => {
  test.setTimeout(180_000);
  // Unique names, so earlier runs' tasks in the test account do not get in the way.
  const run = Date.now().toString(36);
  const fromLaptop = `Written on the laptop ${run}`;
  const fromPhone = `Written on the phone ${run}`;
  // The laptop has data already and signs in first: it becomes the account's data.
  await laptop.goto('/');
  await expect(laptop.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(laptop, fromLaptop);
  await laptop.goto('/settings?section=account');
  await signIn(laptop);
  await expect(laptop.getByText(`Signed in as ${email}`)).toBeVisible();
  // The account may already hold data from earlier runs: then the app asks, and both are combined.
  const combine = laptop.getByRole('button', { name: /Combine both/ });
  await combine.or(laptop.getByText(/^Synced/)).first().waitFor({ timeout: 20_000 });
  if (await combine.isVisible()) await combine.click();
  await expect(laptop.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });

  // A brand-new phone signs in from the welcome screen and gets everything, setup included.
  const phoneContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
  const phone = await phoneContext.newPage();
  await phone.goto('/');
  await expect(phone).toHaveURL(/\/welcome$/);
  await phone.getByRole('button', { name: /Already use Life Of Pi on another device/ }).click();
  await signIn(phone);
  await expect(phone).toHaveURL(/\/today$/, { timeout: 20_000 });
  await expect(card(phone, fromLaptop)).toBeVisible();

  // A change on the phone reaches the laptop.
  await addTasks(phone, fromPhone);
  await phone.goto('/settings?section=account');
  await phone.getByRole('button', { name: 'Sync now' }).click();
  await expect(phone.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });
  await laptop.getByRole('button', { name: 'Sync now' }).click();
  await expect(laptop.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });
  await laptop.goto('/today');
  await expect(card(laptop, fromPhone)).toBeVisible({ timeout: 20_000 });
  await expect(card(laptop, fromLaptop)).toBeVisible();

  // And a deletion on the laptop reaches the phone.
  await card(laptop, fromLaptop).hover();
  await laptop.keyboard.press('Control+Backspace');
  await laptop.goto('/settings?section=account');
  await laptop.getByRole('button', { name: 'Sync now' }).click();
  await expect(laptop.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });
  await phone.getByRole('button', { name: 'Sync now' }).click();
  await expect(phone.getByTestId('sync-status')).toHaveText(/Synced/, { timeout: 20_000 });
  await phone.goto('/today');
  await expect(card(phone, fromPhone)).toBeVisible();
  await expect(card(phone, fromLaptop)).toHaveCount(0);
  await phoneContext.close();
});
