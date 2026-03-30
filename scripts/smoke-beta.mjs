import { chromium, expect } from '@playwright/test';

const APP_URL = process.env.SIXMIN_APP_URL ?? 'https://attorney-time-track.vercel.app';
const email = process.env.SIXMIN_QA_EMAIL;
const password = process.env.SIXMIN_QA_PASSWORD;
const prefix = process.env.SIXMIN_QA_PREFIX ?? 'Smoke Client ';

if (!email || !password) {
  console.error('Set SIXMIN_QA_EMAIL and SIXMIN_QA_PASSWORD');
  process.exit(1);
}

const stamp = Date.now();
const clientName = `${prefix}${stamp}`;
const matterName = `Matter ${stamp}`;
const timerNote = `Timer note ${stamp}`;
const expenseDesc = `Filing fee ${stamp}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function selectComboboxOption(index, optionName) {
  const box = page.locator('button[role="combobox"]').nth(index);
  await box.scrollIntoViewIfNeeded();
  await box.click();
  await page.getByRole('option', { name: optionName }).click();
}

try {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(`${APP_URL}/`, { timeout: 30000 });

  await page.getByRole('link', { name: 'Clients & Matters' }).click();
  await page.getByRole('button', { name: /New Client/i }).click();
  await page.getByLabel(/^Name$/).fill(clientName);
  await page.getByLabel('First Matter Name').fill(matterName);
  await page.getByLabel('Default Hourly Rate ($)', { exact: true }).fill('250');
  await page.getByRole('button', { name: /Save Client|Saving.../ }).click();
  await page.getByRole('table').getByText(clientName).waitFor();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: /Start timer/i }).click();
  await page.getByPlaceholder('Search by client or matter').fill(clientName);
  await page.getByRole('button', { name: new RegExp(`${clientName}.*${matterName}`) }).click();
  await expect(page.getByRole('button', { name: /Stop timer/i })).toBeEnabled();
  await expect(page.locator('body')).toContainText(matterName);
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Stop timer/i }).click();
  await expect(page.locator(`text=Stop timer for ${matterName}?`).last()).toBeVisible();
  await page.locator('textarea[placeholder="Enter your notes here..."]:visible').last().fill(timerNote);
  await page.locator('button:has-text("Stop & Save"):visible').last().click();
  await expect(page.locator('body')).toContainText('Click play to choose a matter and start tracking.');

  await page.getByRole('link', { name: 'Entries' }).click();
  await page.getByRole('tab', { name: 'Time Entries' }).click();
  await expect(page.getByRole('table')).toContainText(timerNote);
  await expect(page.getByRole('table')).toContainText(matterName);

  await page.getByRole('tab', { name: 'Expenses' }).click();
  await page.getByRole('button', { name: 'Add Expense' }).click();
  await page.getByLabel('Amount ($)', { exact: true }).fill('45');
  await page.getByLabel('Description').fill(expenseDesc);
  await page.getByLabel('Matter').click();
  await page.getByRole('option', { name: new RegExp(`${clientName}.*${matterName}`) }).click();
  await page.getByRole('button', { name: /Save Expense|Saving.../ }).click();
  await page.getByText(expenseDesc).waitFor();

  await page.getByRole('link', { name: 'Invoices' }).click();
  await page.getByRole('link', { name: /New Invoice/i }).click();
  await page.getByRole('heading', { name: 'Invoice Builder' }).first().waitFor();

  await selectComboboxOption(2, clientName);
  await selectComboboxOption(3, matterName);

  const expenseRow = page.locator('div.rounded-md.border > div').filter({ hasText: expenseDesc }).first();
  await expenseRow.getByRole('checkbox').click();

  await expect(page.locator('body')).toContainText('$45.00');
  await page.getByRole('button', { name: /Create Draft Invoice|Creating/ }).click();
  await page.waitForURL(/\/invoices\//, { timeout: 30000 });

  await page.getByRole('button', { name: /Preview PDF|Download Stored PDF|Download PDF/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Send Invoice' }).click();
  await expect(page.locator('body')).toContainText('Copy Draft');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Record Payment' }).click();
  await page.getByLabel('Amount').fill('45');
  await page.getByRole('button', { name: 'Save Payment' }).click();
  await expect(page.locator('body')).toContainText('Payment recorded');

  await page.goto(`${APP_URL}/reports`, { waitUntil: 'networkidle', timeout: 120000 });
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

  const reportFilters = page.locator('button[role="combobox"]:visible');
  await reportFilters.nth(1).click();
  await page.getByRole('option', { name: clientName }).click();
  await page.waitForTimeout(1500);
  await reportFilters.nth(2).click();
  await page.getByRole('option', { name: matterName }).click();
  await page.waitForTimeout(2000);

  const bodyText = await page.locator('body').innerText();
  if (!/Billed\s+\$45/.test(bodyText)) {
    throw new Error(`Expected filtered Reports to show Billed $45. Body excerpt:\n${bodyText.slice(0, 4000)}`);
  }
  if (!/Collected\s+\$45/.test(bodyText)) {
    throw new Error(`Expected filtered Reports to show Collected $45. Body excerpt:\n${bodyText.slice(0, 4000)}`);
  }
  if (!/Outstanding\s+\$0/.test(bodyText)) {
    throw new Error(`Expected filtered Reports to show Outstanding $0. Body excerpt:\n${bodyText.slice(0, 4000)}`);
  }

  console.log(JSON.stringify({ ok: true, clientName, matterName, timerNote, expenseDesc }, null, 2));
} finally {
  await browser.close();
}
