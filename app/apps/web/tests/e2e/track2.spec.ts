import { test, expect } from '@playwright/test';

test.describe('Track 2 happy path (smoke)', () => {
  test.skip(!process.env.PLAYWRIGHT_TRACK2, 'Set PLAYWRIGHT_TRACK2=1 with stack running');

  test('community page loads', async ({ page }) => {
    await page.goto('http://localhost:8080/#community');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
