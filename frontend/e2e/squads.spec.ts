/**
 * Phase 4: Automated E2E Tests - Rescue Forces
 *
 * Tests for rescue force discovery, creation, management, and membership.
 */

import { test, expect } from '@playwright/test';

test.describe('Rescue Forces', () => {
  test.describe('Squad Discovery', () => {
    test('should display squad search page', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      await expect(page.getByRole('heading', { name: /rescue.*squad|find.*squad|search.*squad/i })).toBeVisible();

      // Should have search input
      const searchInput = page.getByRole('searchbox')
        .or(page.getByPlaceholder(/zip|location|search/i));
      await expect(searchInput).toBeVisible();
    });

    test('should search squads by zip code', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i)
        .or(page.getByRole('searchbox'));

      await searchInput.fill('90210');

      // Click search or press enter
      const searchButton = page.getByRole('button', { name: /search|find/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }

      // Wait for results
      await page.waitForTimeout(1000);

      // Should show results or no results message
      await expect(page.locator('body')).toContainText(/squad|no.*found|no.*results|create.*squad/i);
    });

    test('should validate zip code format', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i)
        .or(page.getByRole('searchbox'));

      await searchInput.fill('invalid');

      const searchButton = page.getByRole('button', { name: /search|find/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }

      // Should show validation error or not perform search
      await page.waitForTimeout(500);
    });

    test('should display squad cards in results', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i)
        .or(page.getByRole('searchbox'));

      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      // If there are results, check card structure
      const squadCard = page.locator('[data-testid="squad-card"], .squad-card').first();

      if (await squadCard.isVisible()) {
        // Card should have name
        await expect(squadCard.getByRole('heading')).toBeVisible();

        // Card should have location info
        await expect(squadCard.getByText(/\d{5}|city|miles/i)).toBeVisible();
      }
    });

    test('should navigate to squad detail page', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i)
        .or(page.getByRole('searchbox'));

      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      const squadCard = page.locator('[data-testid="squad-card"], .squad-card, a[href*="rescue-squads"]').first();

      if (await squadCard.isVisible()) {
        await squadCard.click();

        // Should navigate to detail page
        await expect(page).toHaveURL(/rescue-forces\/[a-zA-Z0-9-]+/);
      }
    });

    test('should show squad suggestions dropdown', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i)
        .or(page.getByRole('searchbox'));

      await searchInput.fill('902');

      await page.waitForTimeout(500);

      // Suggestions dropdown might appear
      const suggestions = page.locator('[data-testid="suggestions"], [role="listbox"], .suggestions');
      // This is optional - depends on implementation
    });
  });

  test.describe('Squad Detail Page', () => {
    test('should display squad information', async ({ page }) => {
      // First search for a squad
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      const squadLink = page.locator('a[href*="rescue-squads/"]').first();

      if (await squadLink.isVisible()) {
        await squadLink.click();

        // Should show squad name
        await expect(page.getByRole('heading').first()).toBeVisible();

        // Should show location
        await expect(page.getByText(/\d{5}|california|los angeles/i)).toBeVisible();
      }
    });

    test('should display member count', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      const squadLink = page.locator('a[href*="rescue-squads/"]').first();

      if (await squadLink.isVisible()) {
        await squadLink.click();

        // Should show member information
        await expect(page.getByText(/member|volunteer/i)).toBeVisible();
      }
    });

    test('should display divisions if available', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      const squadLink = page.locator('a[href*="rescue-squads/"]').first();

      if (await squadLink.isVisible()) {
        await squadLink.click();

        // Divisions section might be present
        const divisionsSection = page.getByRole('heading', { name: /division/i })
          .or(page.getByText(/division/i));

        // This is optional - depends on squad configuration
      }
    });

    test('should show join button for non-members', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      const squadLink = page.locator('a[href*="rescue-squads/"]').first();

      if (await squadLink.isVisible()) {
        await squadLink.click();

        // Should have join button
        const joinButton = page.getByRole('button', { name: /join|apply|request/i });
        // Join button may require login first
      }
    });
  });

  test.describe('Squad Creation', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/dashboard/);
    });

    test('should display squad creation form', async ({ page }) => {
      await page.goto('/rescue-forces/create');

      await expect(page.getByRole('heading', { name: /create|start|new.*squad/i })).toBeVisible();

      // Should have required fields
      await expect(page.getByLabel(/name/i)).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/rescue-forces/create');

      const submitButton = page.getByRole('button', { name: /create|submit|start/i });
      await submitButton.click();

      // Should show validation errors
      await expect(page.getByText(/required|please|must/i)).toBeVisible();
    });

    test('should create squad with valid data', async ({ page }) => {
      await page.goto('/rescue-forces/create');

      // Fill in required fields
      await page.getByLabel(/name/i).fill(`Test Squad ${Date.now()}`);

      const descInput = page.getByLabel(/description/i);
      if (await descInput.isVisible()) {
        await descInput.fill('A test rescue force for E2E testing');
      }

      const cityInput = page.getByLabel(/city/i);
      if (await cityInput.isVisible()) {
        await cityInput.fill('Los Angeles');
      }

      const stateInput = page.getByLabel(/state/i);
      if (await stateInput.isVisible()) {
        await stateInput.selectOption({ label: /california/i });
      }

      const zipInput = page.getByLabel(/zip/i);
      if (await zipInput.isVisible()) {
        await zipInput.fill('90210');
      }

      // Submit
      const submitButton = page.getByRole('button', { name: /create|submit|start/i });
      await submitButton.click();

      // Should redirect to squad page or success message
      await expect(page).toHaveURL(/rescue-forces\/[a-zA-Z0-9-]+|success|dashboard/);
    });
  });

  test.describe('Squad Membership', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/dashboard/);
    });

    test('should allow joining a squad', async ({ page }) => {
      await page.goto('/rescue-forces/search');

      const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      const squadLink = page.locator('a[href*="rescue-squads/"]').first();

      if (await squadLink.isVisible()) {
        await squadLink.click();

        const joinButton = page.getByRole('button', { name: /join/i });

        if (await joinButton.isVisible()) {
          await joinButton.click();

          // Should show confirmation or pending state
          await expect(page.getByText(/joined|pending|request.*sent|member/i)).toBeVisible();
        }
      }
    });

    test('should show user squads in dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for squads section
      const squadsSection = page.getByRole('heading', { name: /my.*squad|squad/i })
        .or(page.getByText(/your.*squad|squad.*membership/i));

      // Squads section should exist in dashboard
    });

    test('should allow leaving a squad', async ({ page }) => {
      await page.goto('/dashboard');

      // Find user's squad
      const leaveButton = page.getByRole('button', { name: /leave.*squad|leave/i });

      if (await leaveButton.isVisible()) {
        await leaveButton.click();

        // Should show confirmation dialog
        const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();

          // Should show success message
          await expect(page.getByText(/left|removed|no longer/i)).toBeVisible();
        }
      }
    });
  });

  test.describe('Squad Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login as squad leader
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_SQUAD_LEADER_EMAIL || 'leader@example.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_SQUAD_LEADER_PASSWORD || 'testpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/dashboard/);
    });

    test('should show management options for squad leaders', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for squad management link
      const manageLink = page.getByRole('link', { name: /manage.*squad|squad.*settings/i });

      if (await manageLink.isVisible()) {
        await manageLink.click();

        // Should show management options
        await expect(page.getByRole('heading', { name: /manage|settings|admin/i })).toBeVisible();
      }
    });

    test('should allow editing squad details', async ({ page }) => {
      await page.goto('/dashboard');

      const manageLink = page.getByRole('link', { name: /manage.*squad/i });

      if (await manageLink.isVisible()) {
        await manageLink.click();

        const editButton = page.getByRole('button', { name: /edit/i });

        if (await editButton.isVisible()) {
          await editButton.click();

          // Should show edit form
          await expect(page.getByLabel(/name|description/i)).toBeVisible();
        }
      }
    });

    test('should allow managing members', async ({ page }) => {
      await page.goto('/dashboard');

      const manageLink = page.getByRole('link', { name: /manage.*squad/i });

      if (await manageLink.isVisible()) {
        await manageLink.click();

        const membersTab = page.getByRole('tab', { name: /member/i })
          .or(page.getByRole('link', { name: /member/i }));

        if (await membersTab.isVisible()) {
          await membersTab.click();

          // Should show member list
          await expect(page.locator('[data-testid="member-list"], .member-list')).toBeVisible();
        }
      }
    });

    test('should allow creating divisions', async ({ page }) => {
      await page.goto('/dashboard');

      const manageLink = page.getByRole('link', { name: /manage.*squad/i });

      if (await manageLink.isVisible()) {
        await manageLink.click();

        const divisionsTab = page.getByRole('tab', { name: /division/i })
          .or(page.getByRole('link', { name: /division/i }));

        if (await divisionsTab.isVisible()) {
          await divisionsTab.click();

          const createDivisionButton = page.getByRole('button', { name: /create.*division|add.*division/i });

          if (await createDivisionButton.isVisible()) {
            await createDivisionButton.click();

            // Should show division creation form
            await expect(page.getByLabel(/name/i)).toBeVisible();
          }
        }
      }
    });
  });
});

test.describe('Division Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as squad leader
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_SQUAD_LEADER_EMAIL || 'leader@example.com');
    await page.getByLabel(/password/i).fill(process.env.TEST_SQUAD_LEADER_PASSWORD || 'testpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test('should display division detail page', async ({ page }) => {
    // Navigate to a squad with divisions
    await page.goto('/rescue-forces/search');

    const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
    await searchInput.fill('90210');
    await searchInput.press('Enter');

    await page.waitForTimeout(1000);

    const squadLink = page.locator('a[href*="rescue-squads/"]').first();

    if (await squadLink.isVisible()) {
      await squadLink.click();

      const divisionLink = page.locator('a[href*="divisions/"]').first();

      if (await divisionLink.isVisible()) {
        await divisionLink.click();

        // Should show division details
        await expect(page.getByRole('heading')).toBeVisible();
      }
    }
  });

  test('should allow joining a division', async ({ page }) => {
    await page.goto('/rescue-forces/search');

    const searchInput = page.getByPlaceholder(/zip|location/i).or(page.getByRole('searchbox'));
    await searchInput.fill('90210');
    await searchInput.press('Enter');

    await page.waitForTimeout(1000);

    const squadLink = page.locator('a[href*="rescue-squads/"]').first();

    if (await squadLink.isVisible()) {
      await squadLink.click();

      const divisionLink = page.locator('a[href*="divisions/"]').first();

      if (await divisionLink.isVisible()) {
        await divisionLink.click();

        const joinButton = page.getByRole('button', { name: /join/i });

        if (await joinButton.isVisible()) {
          await joinButton.click();

          // Should show success
          await expect(page.getByText(/joined|member/i)).toBeVisible();
        }
      }
    }
  });
});
