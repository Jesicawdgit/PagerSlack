const { test, expect } = require('@playwright/test');

test('create, acknowledge, resolve an incident and verify its timeline', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('employee@pagerslack.dev');
  await page.getByLabel('Password').fill('PagerSlack2026!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('link', { name: 'Incidents', exact: true }).click();
  await page.getByRole('button', { name: 'Create Incident' }).click();

  const dialog = page.getByRole('dialog');
  const title = `Playwright test incident ${Date.now()}`;
  await dialog.getByLabel('Title').fill(title);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await page.getByText(title).click();
  await expect(page.getByText('Reported by John')).toBeVisible();

  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText('ACKNOWLEDGED', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByText('This incident is resolved.')).toBeVisible();

  await expect(page.getByText('reported this incident')).toBeVisible();
  await expect(page.getByText('acknowledged this incident')).toBeVisible();
  await expect(page.getByText('resolved this incident')).toBeVisible();
});
