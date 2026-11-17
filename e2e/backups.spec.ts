import type { Page } from '@playwright/test';
import { expect, setProfile, test, addTasks } from './fixtures';

const tasks = (page: Page) => page.getByTestId('task');

test('backups run on their own, can be made by hand, and an older one can be restored safely', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await addTasks(page, 'Keep me');

  // The first automatic backup comes shortly after opening.
  await page.clock.fastForward('00:20');
  await page.goto('/settings?section=data');
  const section = page.getByRole('region', { name: 'Automatic backups' });
  await expect(section.getByTestId('backup-status')).toHaveText('Last backup Nov 17, 09:00.');
  await expect(section.getByTestId('backup-entry')).toHaveCount(1);

  // A mistake, then a backup by hand.
  await page.goto('/today');
  await addTasks(page, 'Oops');
  await page.clock.fastForward('05:00');
  await page.goto('/settings?section=data');
  await section.getByRole('button', { name: 'Back up now' }).click();
  await expect(section.getByTestId('backup-entry')).toHaveCount(2);

  // Restore the earlier one: what is here now is saved first.
  await section.getByRole('button', { name: /Restore the backup from Nov 17, 09:00/ }).click();
  await expect(page.getByRole('alert')).toContainText('holds 1 tasks');
  await page.getByRole('button', { name: 'Replace everything' }).click();
  // The app reloads with the restored data.
  await expect(page).toHaveURL(/\/today$/);
  await expect(tasks(page)).toHaveText([/Keep me/]);
  await page.goto('/settings?section=data');
  await expect(section.getByTestId('backup-entry')).toHaveCount(3);
});

test('the web app reminds you weekly to download a copy', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T09:00:00') });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  const reminder = page.getByRole('note', { name: 'Back up your data' });
  // Not in the first week.
  await expect(reminder).toHaveCount(0);
  await setProfile(page, { createdAt: new Date('2026-11-01T09:00:00').getTime() });
  await expect(reminder).toBeVisible();

  const download = page.waitForEvent('download');
  await reminder.getByRole('button', { name: 'Download' }).click();
  expect((await download).suggestedFilename()).toBe('life-of-pi-backup-2026-11-17.json');
  await expect(reminder).toHaveCount(0);

  // A week later it asks again; Later puts it off.
  await page.clock.fastForward(170 * 60 * 60 * 1000);
  await page.reload();
  await expect(reminder).toBeVisible();
  await reminder.getByRole('button', { name: 'Later' }).click();
  await expect(reminder).toHaveCount(0);
});
