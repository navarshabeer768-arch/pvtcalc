import { test, expect, type Browser, type Page } from '@playwright/test';

// This app has no email/password login — the unlock code alone both
// unlocks the calculator and (via the `unlock` Edge Function minting a
// session server-side) signs each person in. Each browser context here
// stands in for one person's own device, so it needs no prior cookies —
// just their code.
const A_CODE = process.env.E2E_A_CODE;
const B_CODE = process.env.E2E_B_CODE;

const hasEnv = A_CODE && B_CODE;

async function unlockViaCalculator(page: Page, code: string) {
  await page.goto('/');
  for (const digit of code) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.getByRole('button', { name: '=' }).click();
}

async function openAsUser(browser: Browser, code: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await unlockViaCalculator(page, code);
  await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10000 });
  return page;
}

test.describe('Calculator disguise', () => {
  test('computes real arithmetic and never reveals chat before unlock', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Calculator/);
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: '7', exact: true }).click();
    await page.getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: '=' }).click();
    await expect(page.getByTestId('main-display')).toHaveText('65');
    expect(page.url()).toBe('http://localhost:5173/');
  });

  test('wrong code behaves like ordinary arithmetic', async ({ page }) => {
    await page.goto('/');
    for (const digit of ['9', '9', '9', '9']) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    await page.getByRole('button', { name: '=' }).click();
    await expect(page.getByTestId('main-display')).toHaveText('9999');
  });
});

test.describe('Two-person chat', () => {
  test.skip(!hasEnv, 'Requires E2E_A_CODE/E2E_B_CODE env vars');

  test('unlock, send, receive, edit, delete, reply, react, typing', async ({ browser }) => {
    const pageA = await openAsUser(browser, A_CODE!);
    const pageB = await openAsUser(browser, B_CODE!);

    // Send + receive.
    const text = `Hello from A ${Date.now()}`;
    await pageA.getByPlaceholder('Type a message...').fill(text);
    await pageA.getByPlaceholder('Type a message...').press('Enter');
    await expect(pageB.getByText(text)).toBeVisible({ timeout: 10000 });

    // Typing indicator.
    await pageA.getByPlaceholder('Type a message...').fill('typing...');
    await expect(pageB.getByText(/is typing/)).toBeVisible({ timeout: 5000 });
    await pageA.getByPlaceholder('Type a message...').fill('');

    // React from B.
    await pageB.getByText(text).click({ button: 'right' });
    await pageB.getByRole('button', { name: 'React' }).click();
    await pageB.getByRole('button', { name: '❤️' }).click();
    await expect(pageA.getByText('❤️')).toBeVisible({ timeout: 10000 });

    // Reply from B, jump from A.
    await pageB.getByText(text).click({ button: 'right' });
    await pageB.getByRole('button', { name: 'Reply' }).click();
    await pageB.getByPlaceholder('Type a message...').fill('Replying!');
    await pageB.getByPlaceholder('Type a message...').press('Enter');
    await expect(pageA.getByText('Replying!')).toBeVisible({ timeout: 10000 });

    // Edit from A.
    await pageA.getByText(text).click({ button: 'right' });
    await pageA.getByRole('button', { name: 'Edit' }).click();
    await pageA.getByPlaceholder('Type a message...').fill('Edited text');
    await pageA.getByPlaceholder('Type a message...').press('Enter');
    await expect(pageB.getByText('Edited text')).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByText('Edited')).toBeVisible();

    // Delete for everyone from A.
    await pageA.getByText('Edited text').click({ button: 'right' });
    await pageA.getByRole('button', { name: 'Delete' }).click();
    await expect(pageB.getByText('This message was deleted')).toBeVisible({ timeout: 10000 });
  });

  test('offline banner appears and outbox sends on reconnect', async ({ browser }) => {
    const pageA = await openAsUser(browser, A_CODE!);
    await pageA.context().setOffline(true);
    await expect(pageA.getByText("You're offline")).toBeVisible({ timeout: 5000 });

    const text = `Offline message ${Date.now()}`;
    await pageA.getByPlaceholder('Type a message...').fill(text);
    await pageA.getByPlaceholder('Type a message...').press('Enter');

    await pageA.context().setOffline(false);
    await expect(pageA.getByText('Back online')).toBeVisible({ timeout: 5000 });
    await expect(pageA.getByText(text)).toBeVisible({ timeout: 10000 });
  });
});
