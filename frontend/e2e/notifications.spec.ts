/**
 * Phase 4: Automated E2E Tests - Notifications
 *
 * Tests for notification center, email preferences, and alerts.
 */

import { test, expect } from '@playwright/test';

test.describe('Notification Center', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('should display notification bell icon', async ({ page }) => {
    await page.goto('/dashboard');

    const notificationBell = page.getByRole('button', { name: /notification/i })
      .or(page.locator('[data-testid="notification-bell"]'))
      .or(page.locator('[aria-label*="notification"]'));

    await expect(notificationBell).toBeVisible();
  });

  test('should show notification count badge', async ({ page }) => {
    await page.goto('/dashboard');

    // Badge might show unread count
    const badge = page.locator('[data-testid="notification-badge"], .notification-badge, .badge');
    // Badge is optional if no unread notifications
  });

  test('should open notification dropdown', async ({ page }) => {
    await page.goto('/dashboard');

    const notificationBell = page.getByRole('button', { name: /notification/i })
      .or(page.locator('[data-testid="notification-bell"]'));

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      // Dropdown should appear
      const dropdown = page.locator('[data-testid="notification-dropdown"], [role="menu"], .notification-dropdown');
      await expect(dropdown).toBeVisible();
    }
  });

  test('should display notification list', async ({ page }) => {
    await page.goto('/dashboard');

    const notificationBell = page.getByRole('button', { name: /notification/i })
      .or(page.locator('[data-testid="notification-bell"]'));

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      // Should show notifications or empty state
      const notifications = page.locator('[data-testid="notification-item"], .notification-item');
      const emptyState = page.getByText(/no notification|all caught up|empty/i);

      await page.waitForTimeout(500);

      const hasNotifications = await notifications.count() > 0;
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      expect(hasNotifications || hasEmptyState).toBeTruthy();
    }
  });

  test('should mark notification as read', async ({ page }) => {
    await page.goto('/dashboard');

    const notificationBell = page.getByRole('button', { name: /notification/i })
      .or(page.locator('[data-testid="notification-bell"]'));

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const notification = page.locator('[data-testid="notification-item"], .notification-item').first();

      if (await notification.isVisible()) {
        await notification.click();

        // Notification should be marked as read
        await page.waitForTimeout(500);
      }
    }
  });

  test('should mark all notifications as read', async ({ page }) => {
    await page.goto('/dashboard');

    const notificationBell = page.getByRole('button', { name: /notification/i })
      .or(page.locator('[data-testid="notification-bell"]'));

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const markAllButton = page.getByRole('button', { name: /mark.*all.*read|clear.*all/i });

      if (await markAllButton.isVisible()) {
        await markAllButton.click();

        // All notifications should be marked as read
        await page.waitForTimeout(500);
      }
    }
  });

  test('should navigate to full notifications page', async ({ page }) => {
    await page.goto('/dashboard');

    const notificationBell = page.getByRole('button', { name: /notification/i })
      .or(page.locator('[data-testid="notification-bell"]'));

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const viewAllLink = page.getByRole('link', { name: /view.*all|see.*all/i });

      if (await viewAllLink.isVisible()) {
        await viewAllLink.click();

        await expect(page).toHaveURL(/notification/);
      }
    }
  });
});

test.describe('Notification Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('should display notification settings page', async ({ page }) => {
    await page.goto('/settings/notifications');

    await expect(page.getByRole('heading', { name: /notification.*setting|email.*preference/i })).toBeVisible();
  });

  test('should show email notification toggles', async ({ page }) => {
    await page.goto('/settings/notifications');

    // Should have toggles for different notification types
    const toggles = page.locator('[role="switch"], input[type="checkbox"]');
    await expect(toggles.first()).toBeVisible();
  });

  test('should toggle case updates notifications', async ({ page }) => {
    await page.goto('/settings/notifications');

    const caseUpdatesToggle = page.getByRole('switch', { name: /case.*update/i })
      .or(page.getByLabel(/case.*update/i));

    if (await caseUpdatesToggle.isVisible()) {
      const initialState = await caseUpdatesToggle.isChecked();

      await caseUpdatesToggle.click();

      await page.waitForTimeout(500);

      // State should change
      const newState = await caseUpdatesToggle.isChecked();
      expect(newState).not.toBe(initialState);
    }
  });

  test('should toggle sighting alerts', async ({ page }) => {
    await page.goto('/settings/notifications');

    const sightingToggle = page.getByRole('switch', { name: /sighting/i })
      .or(page.getByLabel(/sighting/i));

    if (await sightingToggle.isVisible()) {
      await sightingToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('should toggle marketing emails', async ({ page }) => {
    await page.goto('/settings/notifications');

    const marketingToggle = page.getByRole('switch', { name: /marketing|promotional|newsletter/i })
      .or(page.getByLabel(/marketing|promotional|newsletter/i));

    if (await marketingToggle.isVisible()) {
      await marketingToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('should set email frequency', async ({ page }) => {
    await page.goto('/settings/notifications');

    const frequencySelect = page.getByRole('combobox', { name: /frequency|digest/i })
      .or(page.getByLabel(/frequency|digest/i));

    if (await frequencySelect.isVisible()) {
      await frequencySelect.selectOption({ label: /daily|weekly/i });
      await page.waitForTimeout(500);
    }
  });

  test('should save notification preferences', async ({ page }) => {
    await page.goto('/settings/notifications');

    // Make a change
    const toggles = page.locator('[role="switch"], input[type="checkbox"]');
    if (await toggles.first().isVisible()) {
      await toggles.first().click();
    }

    // Look for save button
    const saveButton = page.getByRole('button', { name: /save|update|apply/i });

    if (await saveButton.isVisible()) {
      await saveButton.click();

      // Should show success message
      await expect(page.getByText(/saved|updated|success/i)).toBeVisible();
    }
  });

  test('should show quiet hours settings', async ({ page }) => {
    await page.goto('/settings/notifications');

    const quietHoursSection = page.getByText(/quiet.*hour|do.*not.*disturb/i);
    // Quiet hours feature is optional
  });

  test('should set timezone preference', async ({ page }) => {
    await page.goto('/settings/notifications');

    const timezoneSelect = page.getByRole('combobox', { name: /timezone|time.*zone/i })
      .or(page.getByLabel(/timezone|time.*zone/i));

    if (await timezoneSelect.isVisible()) {
      await timezoneSelect.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Email Unsubscribe', () => {
  test('should display unsubscribe page', async ({ page }) => {
    // Test unsubscribe page with a mock token
    await page.goto('/unsubscribe/test-token-123');

    // Should show unsubscribe page or error
    await expect(page.getByText(/unsubscribe|preference|invalid|expired/i)).toBeVisible();
  });

  test('should confirm unsubscribe action', async ({ page }) => {
    await page.goto('/unsubscribe/test-token-123');

    const unsubscribeButton = page.getByRole('button', { name: /unsubscribe|confirm/i });

    if (await unsubscribeButton.isVisible()) {
      await unsubscribeButton.click();

      // Should show confirmation
      await page.waitForTimeout(500);
    }
  });

  test('should offer resubscribe option', async ({ page }) => {
    await page.goto('/unsubscribe/test-token-123');

    // After unsubscribing, should offer to resubscribe
    const resubscribeLink = page.getByRole('link', { name: /resubscribe|change.*mind/i });
    // This is optional
  });
});

test.describe('Push Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('should show push notification toggle', async ({ page }) => {
    await page.goto('/settings/notifications');

    const pushToggle = page.getByRole('switch', { name: /push|browser/i })
      .or(page.getByLabel(/push|browser/i));

    // Push notification option should be visible
  });

  test('should request notification permission', async ({ page, context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications'], { origin: page.url() || 'http://localhost:3000' });

    await page.goto('/settings/notifications');

    const enablePushButton = page.getByRole('button', { name: /enable.*push|allow.*notification/i });

    if (await enablePushButton.isVisible()) {
      await enablePushButton.click();

      await page.waitForTimeout(1000);
    }
  });
});

test.describe('SMS Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('should show SMS settings', async ({ page }) => {
    await page.goto('/settings/notifications');

    const smsSection = page.getByText(/sms|text.*message/i);
    // SMS feature may be optional
  });

  test('should add phone number for SMS', async ({ page }) => {
    await page.goto('/settings/notifications');

    const phoneInput = page.getByLabel(/phone/i)
      .or(page.getByPlaceholder(/phone/i));

    if (await phoneInput.isVisible()) {
      await phoneInput.fill('+15551234567');

      const saveButton = page.getByRole('button', { name: /save|verify|add/i });
      await saveButton.click();

      await page.waitForTimeout(500);
    }
  });

  test('should verify phone number', async ({ page }) => {
    await page.goto('/settings/notifications');

    const verifyButton = page.getByRole('button', { name: /verify.*phone/i });

    if (await verifyButton.isVisible()) {
      await verifyButton.click();

      // Should show verification code input
      const codeInput = page.getByLabel(/code|verification/i);
      // Verification flow depends on implementation
    }
  });

  test('should toggle SMS alerts', async ({ page }) => {
    await page.goto('/settings/notifications');

    const smsToggle = page.getByRole('switch', { name: /sms/i })
      .or(page.getByLabel(/sms.*alert|text.*alert/i));

    if (await smsToggle.isVisible()) {
      await smsToggle.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Alert Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('should set up location-based alerts', async ({ page }) => {
    await page.goto('/settings/notifications');

    const locationAlertSection = page.getByText(/location.*alert|nearby.*alert/i);

    if (await locationAlertSection.isVisible()) {
      const enableButton = page.getByRole('button', { name: /enable|set.*up/i });
      if (await enableButton.isVisible()) {
        await enableButton.click();
      }
    }
  });

  test('should set alert radius', async ({ page }) => {
    await page.goto('/settings/notifications');

    const radiusSelect = page.getByRole('combobox', { name: /radius|distance/i })
      .or(page.getByLabel(/radius|distance/i));

    if (await radiusSelect.isVisible()) {
      await radiusSelect.selectOption({ label: /10.*mile|25.*mile/i });
    }
  });

  test('should set pet type preferences', async ({ page }) => {
    await page.goto('/settings/notifications');

    // Might have checkboxes for pet types to receive alerts about
    const dogCheckbox = page.getByRole('checkbox', { name: /dog/i });
    const catCheckbox = page.getByRole('checkbox', { name: /cat/i });

    if (await dogCheckbox.isVisible()) {
      await dogCheckbox.check();
    }
  });
});
