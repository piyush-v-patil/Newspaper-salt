import { expect, test as base, type Locator, type Page } from '@playwright/test';

/** Reads, changes and writes one row of the app's settings store from inside the page. */
async function patchMeta(page: Page, key: 'profile' | 'settings', patch: Record<string, unknown>) {
  await page.evaluate(
    async ({ key, patch }) => {
      const open = indexedDB.open('life-of-pi');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      const current: { value: object } | undefined = await new Promise((resolve) => (store.get(key).onsuccess = (e) => resolve((e.target as IDBRequest).result)));
      store.put({ key, value: { ...(current?.value ?? {}), ...patch } });
      await new Promise((resolve) => (tx.oncomplete = resolve));
      db.close();
    },
    { key, patch },
  );
}

/** Changes the profile directly, then reloads so the app picks it up. */
export async function setProfile(page: Page, patch: Record<string, unknown>) {
  await patchMeta(page, 'profile', patch);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Changes settings directly, then reloads so the app picks them up. */
export async function setSettings(page: Page, patch: Record<string, unknown>) {
  await patchMeta(page, 'settings', patch);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/**
 * Every test starts as someone who has already finished setup, with the
 * ritual prompts switched off so they do not interrupt. The setup flow and
 * the prompts have tests of their own that start from scratch.
 */
export const test = base.extend<{ freshStart: boolean }>({
  freshStart: [false, { option: true }],
  page: async ({ page, freshStart }, use) => {
    if (!freshStart) {
      await page.goto('/');
      await expect(page).toHaveURL(/\/welcome$/);
      await patchMeta(page, 'profile', { name: 'Pi', onboardingCompletedAt: 1, guidedPlansRemaining: 0, setupStep: 4 });
      await patchMeta(page, 'settings', {
        // Tests read times in 24-hour form; the app's own default is 12-hour.
        timeFormat: '24h',
        autoPlanning: false,
        autoShutdown: false,
        weeklyPlan: { weekday: 1, min: 8 * 60, auto: false },
        weeklyReview: { weekday: 5, min: 15 * 60, auto: false },
      });
    }
    await use(page);
  },
});

export { expect };

/**
 * Adds tasks the way a person does: click an "Add task" row, type, press
 * Enter. When the text ends in a typing shortcut such as ~30 or #work, its
 * menu is open and the first Enter picks from it; the next one adds the task.
 */
export async function addTasksVia(page: Page, row: Locator, ...titles: string[]) {
  for (const title of titles) {
    await row.click();
    const input = page.getByLabel('Task title');
    await expect(input).toBeFocused();
    await input.fill(title);
    for (let i = 0; i < 4; i++) {
      const menuOpen = (await page.getByRole('listbox').count()) > 0;
      await input.press('Enter');
      if (!menuOpen) break;
    }
    await expect(page.getByLabel('Task title')).toHaveCount(0);
  }
}

/** Adds tasks from the first "Add task" row on the page. */
export async function addTasks(page: Page, ...titles: string[]) {
  await addTasksVia(page, page.getByLabel(/^Add task to/).first(), ...titles);
}
