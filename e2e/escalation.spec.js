const { test, expect } = require('@playwright/test');

test('unacknowledged incident escalates to the team lead', async ({ page }) => {
  test.setTimeout(40000);

  await page.goto('/login');
  await page.getByLabel('Email').fill('employee@pagerslack.dev');
  await page.getByLabel('Password').fill('PagerSlack2026!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('link', { name: 'Incidents', exact: true }).click();
  await page.getByRole('button', { name: 'Create Incident' }).click();

  const dialog = page.getByRole('dialog');
  const title = `Playwright escalation test ${Date.now()}`;
  await dialog.getByLabel('Title').fill(title);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await page.getByText(title).click();
  await expect(page.getByText('Assigned to John')).toBeVisible();

  // Don't acknowledge — wait for the escalation worker to reassign to the team lead.
  // Timeout covers the 15s demo ack window even if a locally-running backend
  // ignores the short env override this config passes when it starts its own server.
  await expect(page.getByText('Assigned to Sarah')).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('Automatically escalated to Sarah')).toBeVisible();
});
