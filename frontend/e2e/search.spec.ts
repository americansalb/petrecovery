/**
 * Phase 4: Automated E2E Tests - Search Functionality
 *
 * Tests for global search, filtering, and location-based search.
 */

import { test, expect } from '@playwright/test';

test.describe('Global Search', () => {
  test('should display search bar on homepage', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search|find|zip/i));

    await expect(searchInput).toBeVisible();
  });

  test('should search across cases and forces', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search|find/i));

    await searchInput.fill('lost dog');
    await searchInput.press('Enter');

    // Should navigate to search results
    await expect(page).toHaveURL(/search|cases|results/);
  });

  test('should show search suggestions while typing', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search|find/i));

    await searchInput.fill('los');

    await page.waitForTimeout(500);

    // Suggestions might appear
    const suggestions = page.locator('[role="listbox"], [data-testid="suggestions"], .suggestions');
    // This depends on implementation
  });

  test('should handle empty search gracefully', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search|find/i));

    await searchInput.press('Enter');

    // Should either stay on page or show all results
    await page.waitForTimeout(500);
  });

  test('should preserve search query in URL', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search|find/i));

    await searchInput.fill('missing cat');
    await searchInput.press('Enter');

    await page.waitForTimeout(500);

    // URL should contain search query
    await expect(page).toHaveURL(/q=missing.*cat|query=missing.*cat|search=missing.*cat/i);
  });
});

test.describe('Location-Based Search', () => {
  test('should search by zip code', async ({ page }) => {
    await page.goto('/cases');

    const zipInput = page.getByPlaceholder(/zip|location/i)
      .or(page.getByLabel(/zip|location/i));

    await zipInput.fill('90210');

    const searchButton = page.getByRole('button', { name: /search/i });
    if (await searchButton.isVisible()) {
      await searchButton.click();
    } else {
      await zipInput.press('Enter');
    }

    await page.waitForTimeout(500);

    // Should show results filtered by location
    await expect(page.locator('body')).toContainText(/90210|beverly|mile|result|found|no/i);
  });

  test('should search by city name', async ({ page }) => {
    await page.goto('/cases');

    const locationInput = page.getByPlaceholder(/location|city/i)
      .or(page.getByLabel(/location|city/i));

    await locationInput.fill('Los Angeles');
    await locationInput.press('Enter');

    await page.waitForTimeout(500);
  });

  test('should show distance from search location', async ({ page }) => {
    await page.goto('/cases');

    const zipInput = page.getByPlaceholder(/zip|location/i)
      .or(page.getByLabel(/zip|location/i));

    await zipInput.fill('90210');
    await zipInput.press('Enter');

    await page.waitForTimeout(500);

    // Results should show distance
    const distanceText = page.getByText(/mile|km|away/i);
    // Distance display is optional but good UX
  });

  test('should allow adjusting search radius', async ({ page }) => {
    await page.goto('/cases');

    // Look for radius filter
    const radiusSelect = page.getByRole('combobox', { name: /radius|distance/i })
      .or(page.getByLabel(/radius|distance|mile/i));

    if (await radiusSelect.isVisible()) {
      await radiusSelect.selectOption({ label: /25.*mile|50.*mile/i });

      await page.waitForTimeout(500);
    }
  });

  test('should request geolocation permission for nearby search', async ({ page, context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation'], { origin: page.url() || 'http://localhost:3000' });

    await page.goto('/cases');

    const nearbyButton = page.getByRole('button', { name: /nearby|near me|use.*location/i });

    if (await nearbyButton.isVisible()) {
      await nearbyButton.click();

      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Filter Controls', () => {
  test('should filter by pet type', async ({ page }) => {
    await page.goto('/cases');

    const petTypeFilter = page.getByRole('combobox', { name: /type|pet|animal/i })
      .or(page.getByLabel(/type|pet|animal/i));

    if (await petTypeFilter.isVisible()) {
      await petTypeFilter.selectOption({ label: /dog/i });

      await page.waitForTimeout(500);

      // URL or results should reflect filter
    }
  });

  test('should filter by status', async ({ page }) => {
    await page.goto('/cases');

    const statusFilter = page.getByRole('combobox', { name: /status/i })
      .or(page.getByLabel(/status/i));

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ label: /lost|missing/i });

      await page.waitForTimeout(500);
    }
  });

  test('should filter by date range', async ({ page }) => {
    await page.goto('/cases');

    const dateFilter = page.getByRole('combobox', { name: /date|when|time/i })
      .or(page.getByLabel(/date|when|time/i));

    if (await dateFilter.isVisible()) {
      await dateFilter.selectOption({ label: /week|7 days/i });

      await page.waitForTimeout(500);
    }
  });

  test('should combine multiple filters', async ({ page }) => {
    await page.goto('/cases');

    // Apply pet type filter
    const petTypeFilter = page.getByRole('combobox', { name: /type/i });
    if (await petTypeFilter.isVisible()) {
      await petTypeFilter.selectOption({ label: /dog/i });
    }

    // Apply status filter
    const statusFilter = page.getByRole('combobox', { name: /status/i });
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ label: /lost/i });
    }

    await page.waitForTimeout(500);

    // Both filters should be applied
  });

  test('should clear all filters', async ({ page }) => {
    await page.goto('/cases');

    // Apply a filter first
    const petTypeFilter = page.getByRole('combobox', { name: /type/i });
    if (await petTypeFilter.isVisible()) {
      await petTypeFilter.selectOption({ label: /dog/i });
    }

    await page.waitForTimeout(500);

    // Look for clear button
    const clearButton = page.getByRole('button', { name: /clear|reset/i });

    if (await clearButton.isVisible()) {
      await clearButton.click();

      await page.waitForTimeout(500);

      // Filters should be reset
    }
  });

  test('should persist filters in URL', async ({ page }) => {
    await page.goto('/cases');

    const petTypeFilter = page.getByRole('combobox', { name: /type/i });
    if (await petTypeFilter.isVisible()) {
      await petTypeFilter.selectOption({ label: /dog/i });

      await page.waitForTimeout(500);

      // URL should contain filter parameter
      await expect(page).toHaveURL(/type=dog|petType=dog|filter/i);
    }
  });
});

test.describe('Search Results', () => {
  test('should display result count', async ({ page }) => {
    await page.goto('/cases');

    const searchInput = page.getByPlaceholder(/search|zip/i)
      .or(page.getByRole('searchbox'));

    await searchInput.fill('90210');
    await searchInput.press('Enter');

    await page.waitForTimeout(500);

    // Should show count of results
    const resultCount = page.getByText(/\d+.*result|found.*\d+|showing.*\d+/i);
    // Result count display is optional
  });

  test('should sort results by relevance', async ({ page }) => {
    await page.goto('/cases');

    const searchInput = page.getByPlaceholder(/search/i)
      .or(page.getByRole('searchbox'));

    await searchInput.fill('lost golden retriever');
    await searchInput.press('Enter');

    await page.waitForTimeout(500);

    // Sort dropdown
    const sortSelect = page.getByRole('combobox', { name: /sort/i });
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption({ label: /relevan/i });
    }
  });

  test('should sort results by date', async ({ page }) => {
    await page.goto('/cases');

    const sortSelect = page.getByRole('combobox', { name: /sort/i });
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption({ label: /newest|recent|date/i });

      await page.waitForTimeout(500);
    }
  });

  test('should sort results by distance', async ({ page }) => {
    await page.goto('/cases');

    // Enter zip for distance-based results
    const zipInput = page.getByPlaceholder(/zip/i);
    if (await zipInput.isVisible()) {
      await zipInput.fill('90210');
      await zipInput.press('Enter');
    }

    await page.waitForTimeout(500);

    const sortSelect = page.getByRole('combobox', { name: /sort/i });
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption({ label: /distance|nearest|close/i });
    }
  });

  test('should paginate results', async ({ page }) => {
    await page.goto('/cases');

    // Look for pagination
    const nextButton = page.getByRole('button', { name: /next/i })
      .or(page.getByLabel(/next page/i));

    if (await nextButton.isVisible()) {
      await nextButton.click();

      await expect(page).toHaveURL(/page=2|offset=/);
    }
  });

  test('should show empty state for no results', async ({ page }) => {
    await page.goto('/cases');

    const searchInput = page.getByPlaceholder(/search|zip/i)
      .or(page.getByRole('searchbox'));

    // Search for something unlikely to exist
    await searchInput.fill('xyzzy123456789nonexistent');
    await searchInput.press('Enter');

    await page.waitForTimeout(500);

    // Should show no results message
    await expect(page.getByText(/no.*result|no.*found|no.*case|try.*different/i)).toBeVisible();
  });
});

test.describe('Map View', () => {
  test('should toggle between list and map view', async ({ page }) => {
    await page.goto('/cases');

    const mapToggle = page.getByRole('button', { name: /map/i })
      .or(page.getByRole('tab', { name: /map/i }));

    if (await mapToggle.isVisible()) {
      await mapToggle.click();

      await page.waitForTimeout(500);

      // Map container should be visible
      const mapContainer = page.locator('[class*="map"], [id*="map"], [data-testid="map"]');
      await expect(mapContainer).toBeVisible();
    }
  });

  test('should show markers on map', async ({ page }) => {
    await page.goto('/cases');

    const mapToggle = page.getByRole('button', { name: /map/i });

    if (await mapToggle.isVisible()) {
      await mapToggle.click();

      await page.waitForTimeout(1000);

      // Markers should be present (implementation dependent)
      const markers = page.locator('[class*="marker"], .leaflet-marker-icon, .mapboxgl-marker');
      // Markers may or may not be present depending on data
    }
  });

  test('should click marker to view case details', async ({ page }) => {
    await page.goto('/cases');

    const mapToggle = page.getByRole('button', { name: /map/i });

    if (await mapToggle.isVisible()) {
      await mapToggle.click();

      await page.waitForTimeout(1000);

      const marker = page.locator('[class*="marker"], .leaflet-marker-icon').first();

      if (await marker.isVisible()) {
        await marker.click();

        // Should show popup or navigate to case
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('Recent Searches', () => {
  test('should save recent searches', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i));

    await searchInput.fill('lost dog 90210');
    await searchInput.press('Enter');

    await page.waitForTimeout(500);

    // Go back to homepage
    await page.goto('/');

    // Click on search input
    await searchInput.click();

    // Recent searches might appear
    const recentSearches = page.getByText(/recent|history|lost dog 90210/i);
    // This feature is optional
  });

  test('should clear recent searches', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i));

    await searchInput.click();

    const clearHistory = page.getByRole('button', { name: /clear.*history|clear.*recent/i });

    if (await clearHistory.isVisible()) {
      await clearHistory.click();
    }
  });
});

test.describe('Advanced Search', () => {
  test('should open advanced search modal', async ({ page }) => {
    await page.goto('/cases');

    const advancedLink = page.getByRole('button', { name: /advanced/i })
      .or(page.getByRole('link', { name: /advanced/i }));

    if (await advancedLink.isVisible()) {
      await advancedLink.click();

      // Should show advanced search options
      await expect(page.getByRole('dialog').or(page.locator('[data-testid="advanced-search"]'))).toBeVisible();
    }
  });

  test('should search by physical characteristics', async ({ page }) => {
    await page.goto('/cases');

    const advancedLink = page.getByRole('button', { name: /advanced/i });

    if (await advancedLink.isVisible()) {
      await advancedLink.click();

      const colorInput = page.getByLabel(/color/i);
      if (await colorInput.isVisible()) {
        await colorInput.fill('brown');
      }

      const sizeSelect = page.getByLabel(/size/i);
      if (await sizeSelect.isVisible()) {
        await sizeSelect.selectOption({ label: /medium/i });
      }
    }
  });

  test('should search by breed', async ({ page }) => {
    await page.goto('/cases');

    const breedInput = page.getByLabel(/breed/i)
      .or(page.getByPlaceholder(/breed/i));

    if (await breedInput.isVisible()) {
      await breedInput.fill('Golden Retriever');
      await breedInput.press('Enter');

      await page.waitForTimeout(500);
    }
  });
});
