import { expect, test as base, type Page } from '@playwright/test';

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
      await patchMeta(page, 'settings', { autoPlanning: false, autoShutdown: false });
    }
    await use(page);
  },
});

export { expect };
