// End-to-end checks of every admin-portal feature against a real API and
// database seeded by apps/api/test/e2e/seed.js. Tests run in order and build
// on each other (like a staff member's working day).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const seed = JSON.parse(fs.readFileSync(process.env.SEED_FILE, 'utf8'));

// The API runs with EMAIL_PROVIDER=log, so "sent" emails are in its log.
const latestEmailCode = (email) => {
  const lines = fs.readFileSync(process.env.API_LOG, 'utf8').split('\n');
  const line = [...lines].reverse().find((l) => l.includes(`[notify:email] to ${email}`));
  return line && line.match(/code is (\d{6})/)[1];
};
const RESOLUTION_PHOTO = path.join(__dirname, '..', '..', '..', 'apps', 'api', 'test', 'fixtures', 'streetlight.jpg');

test.describe.configure({ mode: 'serial' });

// Signs in and, unless a refusal is expected, waits until the session is
// stored and the Overview page is shown.
const login = async (page, email, password, { expectSuccess = true } = {}) => {
  await page.goto('/login');
  await page.getByLabel(/Email Address/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  if (expectSuccess) {
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  }
};

const logout = async (page) => {
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
};

const pickOption = async (page, label, option) => {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

const stat = (page, label) => page.getByTestId(`stat-${label}`);
const rows = (page) => page.locator('.MuiDataGrid-row');

let staffEmail;
let staffPassword;

test('citizens cannot sign in to the admin portal', async ({ page }) => {
  await login(page, seed.asha.email, seed.asha.password, { expectSuccess: false });
  await expect(page.getByText('restricted to staff and admin')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('wrong password shows an error', async ({ page }) => {
  await login(page, seed.admin.email, 'definitely-wrong', { expectSuccess: false });
  await expect(page.getByText('Invalid credentials')).toBeVisible();
});

test('admin sees the overview statistics', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(stat(page, 'Total issues')).toHaveText('3');
  await expect(stat(page, 'Open')).toHaveText('2');
  await expect(stat(page, 'In Progress')).toHaveText('1');
  await expect(stat(page, 'Resolved')).toHaveText('0');
  await expect(stat(page, 'Needs review')).toHaveText('2');
  await expect(page.getByTestId('stat-reported-7d')).toHaveText('3');
  await expect(page.getByLabel('Pothole: 1')).toBeVisible();
  await expect(page.getByLabel('Garbage: 1')).toBeVisible();
});

test('overview cards open the issue list with the matching filter', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.getByLabel('Garbage: 1').click();
  await expect(page).toHaveURL(/\/issues\?category=garbage/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Garbage pile on 5th Cross');

  await page.goto('/');
  await page.getByRole('button', { name: 'In Progress: 1' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Streetlight out near bus stop');
});

test('overview charts follow the chosen period and show the workload', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await expect(page.getByTestId('trend-chart')).toBeVisible();
  await page.getByRole('button', { name: '7 days', exact: true }).click();
  await expect(page.getByRole('img', { name: /Reported and resolved per day: 3 reported/ })).toBeVisible();
  await expect(stat(page, 'Unassigned')).toHaveText('3');
  await expect(stat(page, 'Assigned to me')).toHaveText('0');
  await expect(page.getByText('No issues are assigned yet')).toBeVisible();
});

test('the map shows every unresolved issue and opens one', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Map' })).toBeVisible();
  await expect(page.getByTestId('map-count')).toHaveText('Showing 3 of 3 issues');
  const markers = page.locator('[data-testid="issue-map"] path.leaflet-interactive');
  await expect(markers).toHaveCount(3);

  await page.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: 'Garbage', exact: true }).click();
  await expect(markers).toHaveCount(1);
  await markers.first().click({ force: true });
  await expect(page.getByText('Garbage pile on 5th Cross').first()).toBeVisible();
  await page.getByRole('button', { name: 'Open issue' }).click();
  await expect(page.getByRole('heading', { name: 'Garbage pile on 5th Cross' })).toBeVisible();
});

test('an issue can be assigned with a priority and due date, and filtered by them', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto(`/issue/${seed.issues.pothole}`);
  await expect(page.getByText('Internal: citizens don')).toBeVisible();
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await pickOption(page, 'Priority', 'Urgent');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const offset = yesterday.getTimezoneOffset() * 60000;
  await page.getByLabel('Due date').fill(new Date(yesterday.getTime() - offset).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Save assignment' }).click();
  await expect(page.getByText('Assignment saved.')).toBeVisible();
  await expect(page.getByText('Urgent priority')).toBeVisible();
  await expect(page.getByText(/^Overdue \(due /)).toBeVisible();

  // Not part of the citizen's timeline.
  const timeline = page.getByRole('list', { name: 'Timeline' });
  await expect(timeline.getByRole('listitem')).toHaveCount(1);

  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await pickOption(page, 'Assigned to', 'Me');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Deep pothole on MG Road');
  await expect(rows(page).first()).toContainText('Urgent');
  await pickOption(page, 'Assigned to', 'Unassigned');
  await expect(rows(page)).toHaveCount(2);
  await pickOption(page, 'Assigned to', 'Anyone');
  await page.getByRole('button', { name: 'Show overdue' }).click();
  await expect(rows(page)).toHaveCount(1);

  await page.goto('/');
  await expect(stat(page, 'Assigned to me')).toHaveText('1');
  await expect(stat(page, 'Overdue')).toHaveText('1');
  await expect(page.getByRole('table', { name: 'Workload' })).toContainText('E2E Admin');
});

test('dark mode can be switched on and is remembered', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 17, 32)');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 17, 32)');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 247, 251)');
});

test('the issue list shows category and reporter, and filters and searches', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);

  const potholeRow = rows(page).filter({ hasText: 'Deep pothole on MG Road' });
  await expect(potholeRow).toContainText('Pothole');
  await expect(potholeRow).toContainText(seed.asha.name);
  await expect(potholeRow).toContainText('Verified');
  await expect(rows(page).filter({ hasText: 'Garbage pile' })).toContainText(seed.ravi.name);

  await pickOption(page, 'Category', 'Streetlight');
  await expect(rows(page)).toHaveCount(1);
  await pickOption(page, 'Category', 'All categories');
  await pickOption(page, 'Status', 'Open');
  await expect(rows(page)).toHaveCount(2);
  await pickOption(page, 'Status', 'All statuses');

  await page.getByLabel('Search issues').fill('ravi');
  await expect(rows(page)).toHaveCount(1);
  await page.getByLabel('Search issues').fill('');

  await page.getByRole('button', { name: /Show Needs Review/ }).click();
  await expect(rows(page)).toHaveCount(2);
});

test('refreshing a deep link keeps the page (single-page app routing)', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto(`/issue/${seed.issues.pothole}`);
  await expect(page.getByRole('heading', { name: 'Deep pothole on MG Road' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Deep pothole on MG Road' })).toBeVisible();
});

test('issue page shows the reporter, photo and timeline', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto(`/issue/${seed.issues.streetlight}`);
  await expect(page.getByText(seed.asha.email)).toBeVisible();
  const timeline = page.getByRole('list', { name: 'Timeline' });
  await expect(timeline.getByText('Reported')).toBeVisible();
  await expect(timeline.getByText('Open → In Progress')).toBeVisible();
  await expect(timeline.getByText('Crew scheduled for Monday')).toBeVisible();

  await page.goto(`/issue/${seed.issues.pothole}`);
  const photo = page.getByRole('img', { name: 'Issue', exact: true });
  await expect(photo).toBeVisible();
  // The photo is served by the API from the database.
  await expect.poll(() => photo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
});

test('staff can change status and category and leave a note for the citizen', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto(`/issue/${seed.issues.garbage}`);

  await pickOption(page, 'Status', 'In Progress');
  await pickOption(page, 'Category', 'Drainage / sewage');
  await page.getByLabel('Note for the citizen (optional)').fill('Sanitation team informed');
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(page.getByText('Update saved')).toBeVisible();

  const timeline = page.getByRole('list', { name: 'Timeline' });
  await expect(timeline.getByText('Open → In Progress')).toBeVisible();
  await expect(timeline.getByText('Sanitation team informed')).toBeVisible();
  await expect(page.getByText('Drainage / sewage').first()).toBeVisible();

  // A note on its own is also a valid update.
  await page.getByLabel('Note for the citizen (optional)').fill('Truck arriving tomorrow 9am');
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(timeline.getByText('Truck arriving tomorrow 9am')).toBeVisible();
});

test('resolving an issue with a resolution photo', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto(`/issue/${seed.issues.pothole}`);

  await pickOption(page, 'Status', 'Resolved');
  await page.getByLabel('Note for the citizen (optional)').fill('Pothole filled and levelled');
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(page.getByText('Update saved')).toBeVisible();

  await page.getByLabel('Resolution photo file').setInputFiles(RESOLUTION_PHOTO);
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText('Photo uploaded.')).toBeVisible();

  const resolved = page.getByRole('img', { name: 'Resolved', exact: true });
  await expect(resolved).toBeVisible();
  await expect.poll(() => resolved.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  const timeline = page.getByRole('list', { name: 'Timeline' });
  await expect(timeline.getByText('Open → Resolved')).toBeVisible();
  await expect(timeline.getByText('Photo added')).toBeVisible();
});

test('overview reflects the changes', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await expect(stat(page, 'Resolved')).toHaveText('1');
  await expect(stat(page, 'In Progress')).toHaveText('2');
  await expect(page.getByTestId('stat-resolved-7d')).toHaveText('1');
  await expect(page.getByTestId('stat-avg-resolution')).not.toHaveText('—');
  await expect(page.getByLabel('Drainage / sewage: 1')).toBeVisible();
});

test('admin adds a staff account and gets a one-time password', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();

  staffEmail = `officer.${Date.now()}@example.com`;
  await page.getByRole('button', { name: 'Add staff' }).click();
  await page.getByLabel('Full name').fill('Ward Officer');
  await page.getByLabel('Email').fill(staffEmail);
  await page.getByRole('button', { name: 'Create account' }).click();
  staffPassword = (await page.getByTestId('temporary-password').textContent()).trim();
  expect(staffPassword.length).toBeGreaterThanOrEqual(12);
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByTestId(`staff-row-${staffEmail}`)).toContainText('Ward Officer');
  // Admins cannot change their own role or reset their own password here.
  await expect(page.getByRole('combobox', { name: `Role for ${seed.admin.email}` })).toHaveAttribute('aria-disabled', 'true');
});

test('a staff member signs in, cannot delete or manage staff, and changes their password', async ({ page }) => {
  await login(page, staffEmail, staffPassword);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Staff', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

  await page.goto('/staff');
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: 'Change password' }).click();
  await page.getByLabel('Current password').fill(staffPassword);
  await page.getByLabel('New password', { exact: true }).fill('officer-new-password');
  await page.getByLabel('Confirm new password').fill('officer-new-password');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByText('Your password has been changed.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await logout(page);

  await login(page, staffEmail, 'officer-new-password');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  staffPassword = 'officer-new-password';
});

test('a staff member resets a forgotten password with a code sent by email', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  const form = page.getByRole('form', { name: 'Reset password' });
  await form.getByLabel(/Email Address/).fill(staffEmail);
  await form.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page.getByText('If an account exists for that email')).toBeVisible();

  await expect.poll(() => latestEmailCode(staffEmail)).toMatch(/^\d{6}$/);
  await form.getByLabel(/^Code from the email/).fill(latestEmailCode(staffEmail));
  await form.getByLabel(/^New password/).fill('reset-by-email-77');
  await form.getByLabel(/^Confirm new password/).fill('reset-by-email-77');
  await form.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Password reset. You can sign in with your new password.')).toBeVisible();

  await login(page, staffEmail, 'reset-by-email-77');
  staffPassword = 'reset-by-email-77';
});

test('the session renews itself after the short-lived access token expires', async ({ page }) => {
  // The API in this test run issues 30-second access tokens (ACCESS_TOKEN_TTL).
  await login(page, seed.admin.email, seed.admin.password);
  await page.waitForTimeout(32_000);
  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(rows(page).first()).toBeVisible();
  await expect(page).toHaveURL(/\/issues/);
});

test('signing out ends the session on the server', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  const token = await page.evaluate(() => localStorage.getItem('admin_token'));
  await logout(page);
  const res = await page.request.get(`${seed.api}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(401);
});

test('five wrong passwords lock an account for 15 minutes', async ({ page }) => {
  for (let i = 0; i < 5; i += 1) {
    await login(page, seed.ravi.email, 'not-the-password', { expectSuccess: false });
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  }
  await login(page, seed.ravi.email, seed.ravi.password, { expectSuccess: false });
  await expect(page.getByText(/Too many wrong passwords\. Try again in 15 minutes/)).toBeVisible();
});

test('admin resets a password and removes staff access', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto('/staff');
  page.on('dialog', (dialog) => dialog.accept());

  const row = page.getByTestId(`staff-row-${staffEmail}`);
  await row.getByRole('button', { name: 'Reset password' }).click();
  const newPassword = (await page.getByTestId('temporary-password').textContent()).trim();
  expect(newPassword).not.toEqual(staffPassword);

  await pickOption(page, `Role for ${staffEmail}`, 'Admin');
  await expect(page.getByRole('combobox', { name: `Role for ${staffEmail}` })).toHaveText('Admin');
  await pickOption(page, `Role for ${staffEmail}`, 'Remove staff access');
  await expect(page.getByTestId(`staff-row-${staffEmail}`)).toHaveCount(0);
  await logout(page);

  // No longer allowed into the portal.
  await login(page, staffEmail, newPassword, { expectSuccess: false });
  await expect(page.getByText('restricted to staff and admin')).toBeVisible();
});

test('admin deletes an issue', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await page.goto('/issues');
  page.on('dialog', (dialog) => dialog.accept());
  const row = rows(page).filter({ hasText: 'Garbage pile on 5th Cross' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).filter({ hasText: 'Garbage pile' })).toHaveCount(0);
});

test('signing out returns to the login page and protects other pages', async ({ page }) => {
  await login(page, seed.admin.email, seed.admin.password);
  await logout(page);
  await page.goto('/issues');
  await expect(page).toHaveURL(/\/login$/);
});
