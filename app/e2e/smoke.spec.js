import { test, expect } from '@playwright/test';

test('app boots, reader and map render', async ({ page }) => {
  await page.goto('/');
  // Reader title shows the active book
  await expect(page.locator('.reader__title').first()).toBeVisible({ timeout: 10_000 });
  // Map canvas is mounted
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 10_000 });
});

test('clicking a place entity opens the InfoCard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.reader__title').first()).toBeVisible({ timeout: 10_000 });

  // First place-type entity in the active paragraph
  const placeEnt = page.locator('.ent.ent-place').first();
  await expect(placeEnt).toBeVisible({ timeout: 10_000 });
  await placeEnt.click();

  await expect(page.locator('.infocard')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.infocard__title')).not.toBeEmpty();
});

test('bookmark a paragraph and find it in the menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.reader__title').first()).toBeVisible({ timeout: 10_000 });

  const para = page.locator('.para').first();
  await para.hover();
  await para.locator('.para__tool[title="收藏此段"]').click();

  // Open bookmarks menu
  await page.locator('button[title^="书签"]').click();
  await expect(page.locator('.picker__menu')).toBeVisible();
  await expect(page.locator('.picker__menu .picker__item').first()).toBeVisible();
});
