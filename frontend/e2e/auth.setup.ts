/**
 * Phase 4: Authentication Setup for E2E Tests
 *
 * This setup file handles authentication state that can be reused across tests.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Skip if no test credentials provided
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    console.log('No test credentials provided, skipping authentication setup');
    return;
  }

  // Go to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD);

  // Click sign in
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for successful login
  await page.waitForURL(/dashboard/);

  // Verify we're logged in
  await expect(page.getByRole('heading', { name: /dashboard|welcome/i })).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

setup('authenticate as squad leader', async ({ page }) => {
  // Skip if no test credentials provided
  if (!process.env.TEST_SQUAD_LEADER_EMAIL || !process.env.TEST_SQUAD_LEADER_PASSWORD) {
    console.log('No squad leader credentials provided, skipping');
    return;
  }

  const squadLeaderAuthFile = path.join(__dirname, '../.playwright/.auth/squad-leader.json');

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(process.env.TEST_SQUAD_LEADER_EMAIL);
  await page.getByLabel(/password/i).fill(process.env.TEST_SQUAD_LEADER_PASSWORD);

  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForURL(/dashboard/);

  await page.context().storageState({ path: squadLeaderAuthFile });
});

setup('authenticate as admin', async ({ page }) => {
  // Skip if no admin credentials provided
  if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
    console.log('No admin credentials provided, skipping');
    return;
  }

  const adminAuthFile = path.join(__dirname, '../.playwright/.auth/admin.json');

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(process.env.TEST_ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(process.env.TEST_ADMIN_PASSWORD);

  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForURL(/dashboard|admin/);

  await page.context().storageState({ path: adminAuthFile });
});
