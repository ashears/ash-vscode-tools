import { test, expect, type Page } from '@playwright/test';

type HarnessWindow = Window & { __messages: Record<string, unknown>[]; acquireVsCodeApi: () => unknown };
async function open(page: Page, fixture = 'reference') {
  await page.addInitScript(({ fixture }) => {
    const target = window as unknown as HarnessWindow;
    target.__messages = [];
    target.acquireVsCodeApi = () => ({
      getState: () => undefined, setState: () => {},
      postMessage(message: Record<string, unknown>) {
        target.__messages.push(message);
        if (message.type === 'ready') void fetch(`/test/fixtures/${fixture}.pdf`).then(response => response.arrayBuffer()).then(bytes => {
          window.postMessage({ type: 'load', bytes, filename: `${fixture}.pdf`, state: { page: 1, zoom: 'page-width', rotation: 0 } }, '*');
        });
      },
    });
  }, { fixture });
  await page.goto('/');
}

test('renders selectable pages, navigates outline, searches, rotates, and copies cited context', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await expect(page.locator('.page[data-page-number="1"] canvas').first()).toBeVisible();
  await expect(page.locator('.textLayer').first()).toContainText('250 milliseconds');
  await expect(page.locator('#outline')).toContainText('1. Retry policy');
  await page.screenshot({ path: 'media/demo.png' });
  await page.locator('.textLayer').first().evaluate(node => {
    const range = document.createRange(); range.selectNodeContents(node.querySelector('span')!);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  });
  await page.getByRole('button', { name: 'Copy selection + citation', exact: true }).click();
  const selected = await page.evaluate(() => (window as unknown as HarnessWindow).__messages.find(message => message.type === 'copySelection'));
  expect(selected).toMatchObject({ startPage: 1, endPage: 1 });
  expect(String(selected?.text)).toContain('ENGINEERING NOTES');
  await page.getByRole('button', { name: '2. Request budget' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('1');
  await page.getByRole('searchbox', { name: 'Find in document' }).fill('jitter');
  await expect(page.locator('#findCount')).toContainText('/1');
  await page.getByRole('button', { name: 'Rotate clockwise' }).click();
  await expect.poll(async () => page.locator('.page').first().evaluate(node => node.clientWidth > node.clientHeight)).toBe(true);
  await page.getByRole('button', { name: 'Copy page + citation', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).__messages.some(message => message.type === 'copyPage'))).toBe(true);
  await page.getByRole('tab', { name: 'Pages', exact: true }).click();
  await expect(page.locator('#thumbnails canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('shows scan and password limitations with useful messages', async ({ page }) => {
  await open(page, 'scanned');
  await expect(page.locator('.page canvas').first()).toBeVisible();
  await expect(page.locator('#status')).toContainText('OCR');
});

test('rejects protected PDFs', async ({ page }) => {
  await open(page, 'protected');
  await expect(page.locator('#loadingText')).toContainText('Password-protected');
});

test('rejects malformed PDFs', async ({ page }) => {
  await open(page, 'malformed');
  await expect(page.locator('#loadingText')).toContainText('Invalid PDF');
});

test('reloads content while preserving page and zoom and blocks command links', async ({ page }) => {
  await open(page);
  await expect(page.locator('.page canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await page.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('1.5');
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await page.evaluate(async () => {
    const bytes = await fetch('/test/fixtures/reference.pdf').then(response => response.arrayBuffer());
    window.postMessage({ type: 'load', bytes, filename: 'reference.pdf' }, '*');
  });
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await expect(page.getByRole('combobox', { name: 'Zoom', exact: true })).toHaveValue('custom');
  await page.evaluate(() => {
    const link = document.createElement('a'); link.href = 'command:workbench.action.terminal.new'; link.textContent = 'Untrusted command'; document.body.append(link);
  });
  await page.getByText('Untrusted command').click();
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).__messages.some(message => message.type === 'externalLink'))).toBe(false);
});
