import { expect, test } from './fixtures';

test('a confirmation link that no longer works lands on Account & sync with a plain explanation', async ({ page }) => {
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page).toHaveURL(/\/settings\?section=account$/);
  await expect(page.getByRole('alert')).toContainText('That confirmation link didn’t work (email link is invalid or has expired)');
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
});
