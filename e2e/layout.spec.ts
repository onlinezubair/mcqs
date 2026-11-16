import { test, expect } from '@playwright/test';

test.describe('exam slide layout', () => {
  test('shows one column per set, all on the same question', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Sample' }).click();
    await page.getByRole('button', { name: /Build/ }).click();
    await page.getByRole('button', { name: /Calibrate/ }).click();
    await page.getByRole('button', { name: /Start Exam/ }).click();

    await expect(page.getByText(/Question 1 of/)).toBeVisible();

    // Defaults create 4 sets (A-D), so 4 columns should be rendered.
    const headings = page.getByText(/^Set [A-Z]$/);
    await expect(headings).toHaveCount(4);
    await expect(page.getByText('Set A', { exact: true })).toBeVisible();
    await expect(page.getByText('Set D', { exact: true })).toBeVisible();
  });

  test('the timer floats instead of taking layout space', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Sample' }).click();
    await page.getByRole('button', { name: /Build/ }).click();
    await page.getByRole('button', { name: /Calibrate/ }).click();
    await page.getByRole('button', { name: /Start Exam/ }).click();

    const timer = page.getByRole('timer');
    await expect(timer).toBeVisible();

    const position = await timer.evaluate(el => getComputedStyle(el).position);
    expect(position).toBe('fixed');

    // Defaults to the top-right corner.
    const box = await timer.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.6);
      expect(box.y).toBeLessThan(viewport.height * 0.25);
    }
  });
});
