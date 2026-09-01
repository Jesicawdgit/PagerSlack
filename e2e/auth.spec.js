const { test, expect } = require('@playwright/test');

test('seeded user can log in and see their workspace', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('employee@pagerslack.dev');
  await page.getByLabel('Password').fill('PagerSlack2026!');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Engineering')).toBeVisible();
  await expect(page.getByText('general')).toBeVisible();
});
