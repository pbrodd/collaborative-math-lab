import { test, expect, type Page } from '@playwright/test';

const password = 'several memorable test words 123';
async function keepCode(page: Page) {
  await expect(page.getByRole('heading', { name: 'Keep your recovery code.' })).toBeVisible();
  const code = await page.locator('.account-secret').innerText();
  await page.getByLabel('I have saved my recovery code.').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  return code;
}
async function signIn(page: Page, handle: string, secret = password) {
  await page.getByLabel('Username', { exact: true }).fill(handle);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account settings' })).toBeVisible();
}
test('host invitations, cross-device accounts, recovery, and unsaved workbook protection', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByLabel('Host setup key').fill('browser-only-disposable-server-setup-secret');
  await page.getByLabel('Username', { exact: true }).fill('host');
  await page.getByLabel('Display name').fill('Host');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Repeat password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await keepCode(page);
  await page.getByRole('button', { name: 'Account settings' }).click();
  await page.getByLabel('Invitation label').fill('Study partner');
  await page.getByRole('button', { name: 'Create invitation' }).click();
  const link = await page.getByLabel('Invitation link', { exact: true }).inputValue();

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await student.goto(link);
  await student.getByLabel('Username', { exact: true }).fill('student');
  await student.getByLabel('Display name').fill('Student');
  await student.getByLabel('Password', { exact: true }).fill(password);
  await student.getByLabel('Repeat password', { exact: true }).fill(password);
  await student.getByRole('button', { name: 'Create account' }).click();
  const recovery = await keepCode(student);
  await student.getByRole('button', { name: 'Open a notebook' }).click();
  await student
    .getByRole('dialog')
    .getByRole('button', { name: /Create workbook/ })
    .click();
  await expect(student.getByRole('dialog')).toHaveCount(0);
  await student.getByLabel('Workbook title').fill('My exam practice');
  await student.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(student.getByRole('alert')).toContainText('before exporting');
  student.once('dialog', (dialog) => dialog.dismiss());
  await student.getByRole('button', { name: /Join a room/ }).click();
  await expect(student.getByRole('dialog')).toHaveCount(0);
  await expect(student.getByLabel('Workbook title')).toHaveValue('My exam practice');
  await student.getByRole('button', { name: 'Save workbook' }).click();
  await expect(student.getByText('Saved for the whole crew.')).toBeVisible();
  const download = student.waitForEvent('download');
  await student.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('my-exam-practice.json');
  const workbookUrl = student.url();

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await second.goto(workbookUrl);
  await signIn(second, 'student');
  await expect(second.getByLabel('Workbook title')).toHaveValue('My exam practice');
  // Polling brings in saved edits while a competing local draft remains intact.
  await student.getByLabel('Workbook title').fill('My local draft');
  await second.getByLabel('Workbook title').fill('Saved on another device');
  await second.getByRole('button', { name: 'Save workbook' }).click();
  await expect(
    student.getByText('A teammate saved a newer version.', { exact: false }),
  ).toBeVisible({ timeout: 10000 });
  await expect(student.getByLabel('Workbook title')).toHaveValue('My local draft');
  await student.getByRole('button', { name: 'Account settings' }).click();
  student.once('dialog', (dialog) => dialog.dismiss());
  await student.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(student.getByRole('dialog')).toBeVisible();
  await student.getByRole('button', { name: 'Close account settings' }).click();
  student.once('dialog', (dialog) => dialog.accept());
  await student.getByRole('button', { name: 'Load shared version' }).click();

  await second.getByRole('button', { name: 'Account settings' }).click();
  await second.getByRole('button', { name: 'Sign out', exact: true }).click();
  await second.getByRole('button', { name: 'Forgot password?' }).click();
  await second.getByLabel('Username', { exact: true }).fill('student');
  await second.getByLabel('Recovery code', { exact: true }).fill(recovery);
  const replacement = 'another memorable password for exams';
  await second.getByLabel('New password', { exact: true }).fill(replacement);
  await second.getByLabel('Repeat password', { exact: true }).fill(replacement);
  await second.getByRole('button', { name: 'Reset password' }).click();
  expect(await keepCode(second)).not.toBe(recovery);
  const revoked = await student.request.get('/api/books');
  expect(revoked.status()).toBe(401);
  await signIn(second, 'student', replacement);
  await expect(second.getByLabel('Workbook title')).toHaveValue('Saved on another device');
  await studentContext.close();
  await secondContext.close();
});
