import { test, expect } from '@playwright/test';
import { CODE_PLACEHOLDER, fillMeta } from './helpers';

test.describe('MCQ Projector smoke', () => {
  test('opens on Setup, not Exam details', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Setup Exam' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'MCQ Projector' })).toHaveCount(0);
  });

  test('Exam details is opt-in from Setup', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Exam details' }).click();
    await expect(page.getByRole('heading', { name: 'MCQ Projector' })).toBeVisible();
    await expect(page.getByPlaceholder(CODE_PLACEHOLDER)).toBeVisible();
  });

  test('requires subject and exam name before continuing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Exam details' }).click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByText(/Please fill in all required fields/)).toBeVisible();
  });

  test('subject code fills semester, subject and full name', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Exam details' }).click();
    await page.getByPlaceholder(CODE_PLACEHOLDER).fill('310');
    await expect(page.getByLabel('Semester')).toHaveValue('1');
    await expect(page.getByText('310 · Semester 1 · Physical Pharmacy-I')).toBeVisible();
  });

  test('semester and subject dropdowns work when no code is entered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Exam details' }).click();
    await page.getByLabel('Semester').selectOption('4');
    await page.getByLabel('Subject *').selectOption({ label: '416 — Applied Pharmaceutical Microbiology & Immunology' });
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.getByRole('heading', { name: 'Setup Exam' })).toBeVisible();
  });

  test('loads the sample exam and builds to the review screen', async ({ page }) => {
    await fillMeta(page);

    await expect(page.getByRole('heading', { name: 'Setup Exam' })).toBeVisible();
    await page.getByRole('button', { name: 'Load Sample' }).click();

    const buildButton = page.getByRole('button', { name: /Build/ });
    await expect(buildButton).toBeEnabled();
    await buildButton.click();

    await expect(page.getByRole('heading', { name: 'Review Exam' })).toBeVisible();
  });

  test('calibrate screen runs the overflow audit and starts the exam', async ({ page }) => {
    await fillMeta(page);
    await page.getByRole('button', { name: 'Load Sample' }).click();
    await page.getByRole('button', { name: /Build/ }).click();
    await page.getByRole('button', { name: /Calibrate/ }).click();

    await expect(page.getByText(/Calibration Preview/)).toBeVisible();
    await page.getByRole('button', { name: /Start Exam/ }).click();

    await expect(page.getByText(/Slide 1 of/)).toBeVisible();
  });

  test('question slide never leaks the answer text in the DOM', async ({ page }) => {
    await fillMeta(page);
    await page.getByRole('button', { name: 'Load Sample' }).click();
    await page.getByRole('button', { name: /Build/ }).click();
    await page.getByRole('button', { name: /Calibrate/ }).click();
    await page.getByRole('button', { name: /Start Exam/ }).click();

    await expect(page.getByText(/Slide 1 of/)).toBeVisible();
    const content = await page.content();
    expect(content).not.toContain('Correct');
    expect(content).not.toContain('Answer:');
  });
});
