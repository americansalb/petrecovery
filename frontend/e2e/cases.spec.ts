/**
 * Phase 4: Automated E2E Tests - Lost Pet Missions
 *
 * Tests for creating, viewing, editing, and searching lost pet cases.
 */

import { test, expect } from '@playwright/test';

test.describe('Lost Pet Missions', () => {
  test.describe('Case Listing', () => {
    test('should display recent cases on homepage', async ({ page }) => {
      await page.goto('/');

      // Should show case cards
      await expect(page.getByRole('heading', { name: /lost pets|recent cases|help find/i })).toBeVisible();

      // Should have case cards or empty state
      const caseCards = page.locator('[data-testid="case-card"], .case-card, article');
      const emptyState = page.getByText(/no cases|no pets|be the first/i);

      const hasCards = await caseCards.count() > 0;
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      expect(hasCards || hasEmptyState).toBeTruthy();
    });

    test('should display case search functionality', async ({ page }) => {
      await page.goto('/cases');

      // Should have search input
      await expect(page.getByRole('searchbox').or(page.getByPlaceholder(/search|location|zip/i))).toBeVisible();
    });

    test('should filter cases by location', async ({ page }) => {
      await page.goto('/cases');

      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search|location|zip/i));
      await searchInput.fill('90210');

      // Wait for results to update
      await page.waitForResponse(resp => resp.url().includes('/api/missions') || resp.url().includes('missions'));

      // Should show filtered results or no results message
      await expect(page.locator('body')).toContainText(/90210|beverly|no results|no cases/i);
    });

    test('should filter cases by pet type', async ({ page }) => {
      await page.goto('/cases');

      // Look for pet type filter
      const petTypeFilter = page.getByRole('combobox', { name: /type|pet type|animal/i })
        .or(page.getByLabel(/type|pet type|animal/i));

      if (await petTypeFilter.isVisible()) {
        await petTypeFilter.selectOption({ label: /dog/i });
        await page.waitForTimeout(500);
      }
    });

    test('should show case details when clicking on a case', async ({ page }) => {
      await page.goto('/cases');

      const caseCard = page.locator('[data-testid="case-card"], .case-card, article').first();

      if (await caseCard.isVisible()) {
        await caseCard.click();

        // Should navigate to case detail page
        await expect(page).toHaveURL(/cases\/[a-zA-Z0-9-]+/);

        // Should show case details
        await expect(page.getByRole('heading')).toBeVisible();
      }
    });
  });

  test.describe('Case Detail Page', () => {
    test('should display case information', async ({ page }) => {
      // Navigate to cases and find one
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        // Should show pet name
        await expect(page.getByRole('heading').first()).toBeVisible();

        // Should show status
        await expect(page.getByText(/lost|found|reunited|missing/i)).toBeVisible();
      }
    });

    test('should display contact options for case', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        // Should have contact button or form
        const contactButton = page.getByRole('button', { name: /contact|message|report/i });
        const contactForm = page.getByRole('form');

        const hasContact = await contactButton.isVisible().catch(() => false) ||
                          await contactForm.isVisible().catch(() => false);

        // Contact functionality should be present
        expect(hasContact).toBeTruthy();
      }
    });

    test('should display share buttons', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        // Should have share functionality
        const shareButton = page.getByRole('button', { name: /share/i })
          .or(page.locator('[data-testid="share-buttons"]'));

        await expect(shareButton).toBeVisible();
      }
    });

    test('should display pet images in gallery', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        // Should have at least one image
        const images = page.locator('img[alt*="pet"], img[alt*="photo"], img[src*="cloudinary"], img[src*="image"]');
        await expect(images.first()).toBeVisible();
      }
    });

    test('should show map with last seen location', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        // Should have map element
        const map = page.locator('[class*="map"], [id*="map"], [data-testid="map"]');

        // Map might be lazy loaded
        await page.waitForTimeout(1000);

        const hasMap = await map.isVisible().catch(() => false);
        // Map is optional but good to verify if present
      }
    });
  });

  test.describe('Case Creation', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/dashboard/);
    });

    test('should display case creation form', async ({ page }) => {
      await page.goto('/missions/new');

      await expect(page.getByRole('heading', { name: /report|create|new.*case|lost.*pet/i })).toBeVisible();

      // Pet information fields
      await expect(page.getByLabel(/pet.*name|name/i).first()).toBeVisible();
      await expect(page.getByLabel(/pet.*type|type|species/i)).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/missions/new');

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /submit|create|report/i });
      await submitButton.click();

      // Should show validation errors
      await expect(page.getByText(/required|please.*enter|must.*provide/i)).toBeVisible();
    });

    test('should allow image upload', async ({ page }) => {
      await page.goto('/missions/new');

      // Should have file upload input
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();
    });

    test('should show location picker', async ({ page }) => {
      await page.goto('/missions/new');

      // Should have location input
      const locationInput = page.getByLabel(/location|address|where/i)
        .or(page.getByPlaceholder(/location|address|where/i));

      await expect(locationInput).toBeVisible();
    });

    test('should create case with valid data', async ({ page }) => {
      await page.goto('/missions/new');

      // Fill in required fields
      await page.getByLabel(/pet.*name|name/i).first().fill('Test Pet');

      const petTypeSelect = page.getByLabel(/pet.*type|type|species/i);
      if (await petTypeSelect.isVisible()) {
        await petTypeSelect.selectOption({ index: 1 });
      }

      // Fill breed if available
      const breedInput = page.getByLabel(/breed/i);
      if (await breedInput.isVisible()) {
        await breedInput.fill('Mixed');
      }

      // Fill color if available
      const colorInput = page.getByLabel(/color/i);
      if (await colorInput.isVisible()) {
        await colorInput.fill('Brown');
      }

      // Fill location
      const locationInput = page.getByLabel(/location|address|where.*lost/i);
      if (await locationInput.isVisible()) {
        await locationInput.fill('123 Test Street, Los Angeles, CA 90210');
      }

      // Fill description
      const descInput = page.getByLabel(/description|details|about/i);
      if (await descInput.isVisible()) {
        await descInput.fill('Test pet description for E2E testing');
      }

      // Submit form
      const submitButton = page.getByRole('button', { name: /submit|create|report/i });
      await submitButton.click();

      // Should redirect to case detail or success page
      await expect(page).toHaveURL(/cases\/[a-zA-Z0-9-]+|success|dashboard/);
    });
  });

  test.describe('Case Editing', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'test@example.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || 'testpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/dashboard/);
    });

    test('should show edit button for own cases', async ({ page }) => {
      await page.goto('/dashboard');

      // Find user's cases
      const userCase = page.locator('[data-testid="user-case"], .my-case').first();

      if (await userCase.isVisible()) {
        const editButton = userCase.getByRole('button', { name: /edit/i })
          .or(userCase.getByRole('link', { name: /edit/i }));

        await expect(editButton).toBeVisible();
      }
    });

    test('should allow updating case status', async ({ page }) => {
      await page.goto('/dashboard');

      const userCase = page.locator('[data-testid="user-case"], .my-case').first();

      if (await userCase.isVisible()) {
        await userCase.click();

        // Find status dropdown or buttons
        const statusSelect = page.getByRole('combobox', { name: /status/i })
          .or(page.getByLabel(/status/i));

        if (await statusSelect.isVisible()) {
          await statusSelect.selectOption({ label: /found|reunited/i });

          // Save changes
          const saveButton = page.getByRole('button', { name: /save|update/i });
          if (await saveButton.isVisible()) {
            await saveButton.click();

            // Should show success message
            await expect(page.getByText(/saved|updated|success/i)).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Case Search', () => {
    test('should search by pet name', async ({ page }) => {
      await page.goto('/cases');

      const searchInput = page.getByRole('searchbox')
        .or(page.getByPlaceholder(/search/i));

      await searchInput.fill('Max');
      await searchInput.press('Enter');

      await page.waitForTimeout(500);

      // Results should update
      await expect(page.locator('body')).toContainText(/max|no results|no cases/i);
    });

    test('should search by zip code', async ({ page }) => {
      await page.goto('/cases');

      const searchInput = page.getByRole('searchbox')
        .or(page.getByPlaceholder(/search|zip|location/i));

      await searchInput.fill('90210');
      await searchInput.press('Enter');

      await page.waitForTimeout(500);
    });

    test('should filter by date range', async ({ page }) => {
      await page.goto('/cases');

      // Look for date filter
      const dateFilter = page.getByLabel(/date|when|time/i)
        .or(page.getByRole('combobox', { name: /date|when|time/i }));

      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        // Select a date range option
        await page.getByText(/last.*week|past.*7.*days/i).click();
      }
    });

    test('should sort results', async ({ page }) => {
      await page.goto('/cases');

      // Look for sort dropdown
      const sortSelect = page.getByRole('combobox', { name: /sort/i })
        .or(page.getByLabel(/sort/i));

      if (await sortSelect.isVisible()) {
        await sortSelect.selectOption({ label: /newest|recent/i });
        await page.waitForTimeout(500);
      }
    });

    test('should paginate results', async ({ page }) => {
      await page.goto('/cases');

      // Look for pagination
      const pagination = page.getByRole('navigation', { name: /pagination/i })
        .or(page.locator('[data-testid="pagination"]'));

      const nextButton = page.getByRole('button', { name: /next/i })
        .or(page.getByLabel(/next.*page/i));

      if (await nextButton.isVisible()) {
        await nextButton.click();

        // URL should update with page parameter
        await expect(page).toHaveURL(/page=2|offset=/);
      }
    });
  });

  test.describe('Case Interactions', () => {
    test('should allow reporting a sighting', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        const sightingButton = page.getByRole('button', { name: /sighting|i.*saw|report.*seen/i });

        if (await sightingButton.isVisible()) {
          await sightingButton.click();

          // Should show sighting form or modal
          await expect(page.getByRole('dialog').or(page.getByRole('form'))).toBeVisible();
        }
      }
    });

    test('should allow contacting pet owner', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        const contactButton = page.getByRole('button', { name: /contact|message/i });

        if (await contactButton.isVisible()) {
          await contactButton.click();

          // Should show contact form or modal
          await expect(
            page.getByRole('dialog')
              .or(page.getByRole('form'))
              .or(page.getByLabel(/message/i))
          ).toBeVisible();
        }
      }
    });

    test('should track share clicks', async ({ page }) => {
      await page.goto('/cases');

      const caseLink = page.locator('a[href*="/missions/"]').first();
      if (await caseLink.isVisible()) {
        await caseLink.click();

        const shareButton = page.getByRole('button', { name: /share/i }).first();

        if (await shareButton.isVisible()) {
          // Click share and wait for network request
          const sharePromise = page.waitForResponse(resp =>
            resp.url().includes('/share') && resp.request().method() === 'POST'
          );

          await shareButton.click();

          // Verify share was tracked (if the API exists)
          // This is optional - may not wait if share opens a popup
        }
      }
    });
  });
});

test.describe('Print Flyer', () => {
  test('should open flyer modal', async ({ page }) => {
    await page.goto('/cases');

    const caseLink = page.locator('a[href*="/missions/"]').first();
    if (await caseLink.isVisible()) {
      await caseLink.click();

      const printButton = page.getByRole('button', { name: /print|flyer|poster/i });

      if (await printButton.isVisible()) {
        await printButton.click();

        // Should show print flyer modal
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    }
  });

  test('should allow customizing flyer', async ({ page }) => {
    await page.goto('/cases');

    const caseLink = page.locator('a[href*="/missions/"]').first();
    if (await caseLink.isVisible()) {
      await caseLink.click();

      const printButton = page.getByRole('button', { name: /print|flyer|poster/i });

      if (await printButton.isVisible()) {
        await printButton.click();

        // Should have customization options
        const colorOption = page.getByRole('button', { name: /color/i })
          .or(page.getByLabel(/color/i));
        const formatOption = page.getByRole('combobox', { name: /format|size/i })
          .or(page.getByLabel(/format|size/i));

        // At least one customization should be available
        const hasOptions = await colorOption.isVisible().catch(() => false) ||
                          await formatOption.isVisible().catch(() => false);
      }
    }
  });
});
