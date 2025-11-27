/**
 * Phase 4: Automated E2E Tests - Authentication Flows
 *
 * Tests for user registration, login, password reset, and logout.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign up|register|create/i })).toBeVisible();
    });

    test('should show validation errors for invalid email', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/first name/i).fill('Test');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign up|register|create/i }).click();

      await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
    });

    test('should show validation errors for short password', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/first name/i).fill('Test');
      await page.getByLabel(/password/i).fill('short');
      await page.getByRole('button', { name: /sign up|register|create/i }).click();

      await expect(page.getByText(/password.*characters|too short/i)).toBeVisible();
    });

    test('should successfully register with valid data', async ({ page }) => {
      const uniqueEmail = `test+${Date.now()}@example.com`;

      await page.goto('/register');

      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/first name/i).fill('Test');
      await page.getByLabel(/password/i).fill('ValidPassword123!');

      // Check for terms checkbox if present
      const termsCheckbox = page.getByRole('checkbox', { name: /terms|agree/i });
      if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check();
      }

      await page.getByRole('button', { name: /sign up|register|create/i }).click();

      // Should redirect to dashboard or verification page
      await expect(page).toHaveURL(/dashboard|verify|success/);
    });
  });

  test.describe('Login', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      await expect(page.getByText(/invalid|incorrect|wrong|not found/i)).toBeVisible();
    });

    test('should show link to forgot password', async ({ page }) => {
      await page.goto('/login');

      const forgotLink = page.getByRole('link', { name: /forgot.*password|reset.*password/i });
      await expect(forgotLink).toBeVisible();
    });

    test('should show link to registration', async ({ page }) => {
      await page.goto('/login');

      const registerLink = page.getByRole('link', { name: /sign up|register|create.*account/i });
      await expect(registerLink).toBeVisible();
    });
  });

  test.describe('Password Reset', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');

      await expect(page.getByRole('heading', { name: /forgot|reset|password/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /send|reset|submit/i })).toBeVisible();
    });

    test('should show confirmation after submitting email', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByRole('button', { name: /send|reset|submit/i }).click();

      // Should show success message regardless of email existence (security)
      await expect(page.getByText(/check.*email|sent|instructions/i)).toBeVisible();
    });

    test('should show validation for invalid email', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByRole('button', { name: /send|reset|submit/i }).click();

      await expect(page.getByText(/valid email|invalid/i)).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/dashboard/);
    });

    test('should successfully logout', async ({ page }) => {
      // Find and click logout button/link
      const logoutButton = page.getByRole('button', { name: /log out|sign out/i })
        .or(page.getByRole('link', { name: /log out|sign out/i }));

      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else {
        // May be in a dropdown menu
        const userMenu = page.getByRole('button', { name: /menu|profile|account/i });
        if (await userMenu.isVisible()) {
          await userMenu.click();
          await page.getByRole('menuitem', { name: /log out|sign out/i }).click();
        }
      }

      // Should redirect to home or login page
      await expect(page).toHaveURL(/^\/$|login|home/);
    });
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login with callback URL
    await expect(page).toHaveURL(/login.*callback|login/);
  });

  test('should redirect to login when accessing settings without auth', async ({ page }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL(/login.*callback|login/);
  });

  test('should redirect to login when accessing admin without auth', async ({ page }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/login|403|forbidden/);
  });
});
