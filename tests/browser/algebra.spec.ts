import { test, expect, type Page } from '@playwright/test';
import type { MathfieldElement } from 'mathlive';

const origin = 'http://127.0.0.1:3108';
async function workbook(page: Page, template: string) {
  const state = await (await page.request.get('/api/account')).json();
  const login = await page.request.post('/api/account', {
    headers: { Origin: origin },
    data: {
      action: state.setupRequired ? 'setup' : 'login',
      username: 'host',
      password: 'several memorable test words 123',
      name: 'Host',
      setupToken: 'browser-only-disposable-server-setup-secret',
    },
  });
  expect(login.ok()).toBeTruthy();
  const created = await page.request.post('/api/books', {
    headers: { Origin: origin },
    data: { action: 'create', kind: 'play', template, name: 'Algebra student' },
  });
  expect(created.ok()).toBeTruthy();
  const { book } = await created.json();
  await page.goto(`/?book=${book.id}`);
  await expect(page.getByRole('heading', { name: /Your working/ })).toBeVisible();
  return book.id as string;
}
async function mathValue(page: Page, label: string, latex: string) {
  const field = page.locator(`math-field[aria-label="${label}"]`);
  await expect(field).toBeVisible();
  await field.evaluate((element, value) => {
    (element as MathfieldElement).value = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }, latex);
}
async function move(page: Page, operation: string, amount = '') {
  await page.getByLabel('Operation', { exact: true }).selectOption(operation);
  if (amount) await mathValue(page, 'Amount for the operation', amount);
  await page.getByRole('button', { name: 'Preview move', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Move preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep this step', exact: true }).click();
}
test('selectable moves, visible cancellation, keyboard access, undo/redo, and saved unfinished MathLive entry', async ({
  page,
}) => {
  const errors: string[] = [],
    externalMath: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/unpkg|jsdelivr|cortexjs\.io/.test(request.url())) externalMath.push(request.url());
  });
  const id = await workbook(page, 'brawl');
  await page.getByRole('button', { name: /independent check/i }).click();
  await page
    .getByRole('button', { name: 'Select 4(x - 3) on the left of case 1', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Distribute this term' }).click();
  await expect(page.locator('.work-step')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Move preview' })).toContainText('Distributed');
  await page.getByRole('button', { name: 'Keep this step' }).click();
  await expect(page.locator('.work-step')).toHaveCount(1);
  await page.getByRole('button', { name: 'Select 2x on the right of case 1', exact: true }).click();
  await page.getByRole('button', { name: 'Subtract 2x from both sides' }).click();
  await expect(page.getByRole('region', { name: 'Move preview' })).toContainText('Subtracted 2x');
  await page.locator('.equation-editor').screenshot({ path: 'outputs/algebra-preview.png' });
  await page.getByRole('button', { name: 'Keep this step' }).click();
  await move(page, 'add', '12');
  await move(page, 'divide', '2');
  await expect(page.locator('.work-step').last().getByRole('math')).toHaveAccessibleName(
    'x equals 11',
  );
  await page.getByRole('button', { name: 'Undo last step' }).click();
  await expect(page.locator('.work-step')).toHaveCount(3);
  await page.getByRole('button', { name: 'Redo step', exact: true }).click();
  await expect(page.locator('.work-step')).toHaveCount(4);
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  const field = page.locator('math-field[aria-label="Next equation"]');
  await expect(field).toBeVisible();
  await field.click();
  await expect(field).toBeFocused();
  await page.keyboard.type('x=');
  await page.getByRole('button', { name: 'Fraction', exact: true }).click();
  await page.keyboard.type('11');
  // An unfinished fraction is a draft, never a checked equation.
  await page.getByRole('button', { name: 'Check and add step', exact: true }).click();
  await expect(page.locator('.equation-editor').getByRole('alert')).toBeVisible();
  await expect(page.locator('.work-step')).toHaveCount(4);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: /Health analyst/ }).click();
  await expect(field).toBeVisible();
  const unfinished = await field.evaluate((e) => (e as MathfieldElement).value);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft saved.', { exact: true })).toBeVisible();
  const saved = (await (await page.request.get(`/api/books/${id}`)).json()).book.contributions.find(
    (c: { task_id: string }) => c.task_id.startsWith('transfer:'),
  );
  expect(saved.work.entry.latex).toBe(unfinished);
  expect(saved.work.steps.at(-1).equation).toBe('x = 11');
  await page.reload();
  await page.getByRole('button', { name: /independent check/i }).click();
  await expect(page.locator('math-field[aria-label="Next equation"]')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('math-field[aria-label="Next equation"]')
        .evaluate((e) => (e as MathfieldElement).value),
    )
    .toBe(unfinished);
  await mathValue(page, 'Next equation', 'x=12');
  const remote = await page.request.patch(`/api/books/${id}`, {
    headers: { Origin: origin },
    data: {
      action: 'save',
      task: 'transfer',
      revision: saved.revision,
      bookRevision: 0,
      work: { ...saved.work, entry: { ...saved.work.entry, latex: 'x=11' } },
    },
  });
  expect(remote.ok()).toBeTruthy();
  await expect(page.getByText('A teammate updated this task.', { exact: false })).toBeVisible({
    timeout: 10000,
  });
  await expect.poll(() => field.evaluate((e) => (e as MathfieldElement).value)).toBe('x=12');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect.poll(() => field.evaluate((e) => (e as MathfieldElement).value)).toBe('x=12');
  expect(errors).toEqual([]);
  expect(externalMath).toEqual([]);
});

test('typed fractions render cleanly, submit with Enter, and keep invalid attempts visible', async ({
  page,
}) => {
  await workbook(page, 'brawl');
  await page.getByRole('button', { name: /Shield analyst/ }).click();
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  const field = page.locator('math-field[aria-label="Next equation"]');
  await expect(field).toBeVisible();
  await field.click();
  await expect(field).toBeFocused();
  await page.keyboard.type('r=1/5');
  await expect.poll(() => field.evaluate((e) => (e as MathfieldElement).value)).toContain('frac');
  await page.keyboard.press('Enter');
  await expect(page.locator('.work-step')).toHaveCount(1);
  await expect(page.locator('.work-step').getByRole('math')).toHaveAccessibleName(
    'r equals fraction 1 over 5 end fraction',
  );
  await expect(page.locator('.work-step.invalid')).toHaveCount(0);
  await field.click();
  await expect(field).toBeFocused();
  await page.keyboard.type('r=5');
  await page.keyboard.press('Enter');
  await expect(page.locator('.work-step')).toHaveCount(2);
  await expect(page.locator('.work-step.invalid')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo last step' }).click();
  await expect(page.locator('.work-step.invalid')).toHaveCount(0);
});

test('absolute-value cases remain visible while either case is edited', async ({ page }) => {
  await workbook(page, 'siege');
  await page.getByRole('button', { name: /independent check/i }).click();
  await move(page, 'subtract', '2');
  await move(page, 'divide', '3');
  await move(page, 'split');
  await expect(page.locator('.selectable-case')).toHaveCount(2);
  await page.getByLabel('Cases to change').selectOption('0');
  await move(page, 'add', '4');
  await expect(page.locator('.work-step').last().getByRole('math').first()).toHaveAccessibleName(
    'x equals 7',
  );
  await expect(page.locator('.work-step').last().getByRole('math').last()).toHaveAccessibleName(
    'x minus 4 equals negative 3',
  );
  await page.getByLabel('Cases to change').selectOption('1');
  await move(page, 'add', '4');
  await expect(page.locator('.work-step').last().getByRole('math').last()).toHaveAccessibleName(
    'x equals 1',
  );
  await expect(page.locator('.work-step.invalid')).toHaveCount(0);
});

test.describe('Touch input', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch layout keeps math controls usable and displays a local algebra keyboard', async ({
    page,
  }) => {
    await workbook(page, 'brawl');
    await page.getByRole('button', { name: /Shield analyst/ }).click();
    await move(page, 'divide', '1500');
    await expect(page.locator('.work-step').last().getByRole('math')).toHaveAccessibleName(
      '1 minus r equals fraction 4 over 5 end fraction',
    );
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    const field = page.locator('math-field[aria-label="Next equation"]');
    await expect(field).toBeVisible();
    await field.tap();
    if (!(await page.evaluate(() => window.mathVirtualKeyboard.visible)))
      await field.locator('[part="virtual-keyboard-toggle"]').tap();
    await expect.poll(() => page.evaluate(() => window.mathVirtualKeyboard.visible)).toBe(true);
    await expect(page.getByText('Algebra', { exact: true }).first()).toBeVisible();
    await page.locator('.MLK__layer.is-visible .MLK__keycap').filter({ hasText: /^1$/ }).tap();
    await expect.poll(() => field.evaluate((e) => (e as MathfieldElement).value)).toBe('1');
    await expect
      .poll(() =>
        field.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight - window.mathVirtualKeyboard.boundingRect.height
          );
        }),
      )
      .toBe(true);
    await page.screenshot({ path: 'outputs/algebra-mobile.png' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
  });
});
