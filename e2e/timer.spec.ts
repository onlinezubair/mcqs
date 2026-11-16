import { test, expect } from '@playwright/test';
import { CODE_PLACEHOLDER, fillMeta } from './helpers';

async function startSampleExam(page: import('@playwright/test').Page) {
  await fillMeta(page);
  await page.getByRole('button', { name: 'Load Sample' }).click();
  await page.getByRole('button', { name: /Build/ }).click();
  await page.getByRole('button', { name: /Calibrate/ }).click();
  await page.getByRole('button', { name: /Start Exam/ }).click();
  await expect(page.getByText(/Slide 1 of/)).toBeVisible();
}

test.describe('timer controls', () => {
  test('P pauses and resumes the slide timer', async ({ page }) => {
    await startSampleExam(page);

    const timer = page.getByRole('timer');
    const timerValue = timer.locator('.floating-timer-value');
    const before = await timerValue.textContent();

    await page.keyboard.press('p');
    await page.waitForTimeout(1500);
    const paused = await timerValue.textContent();
    expect(paused).toBe(before);
    await expect(timer).toHaveAttribute('aria-label', /paused/);

    await page.keyboard.press('p');
    await expect(page.getByText(/Slide 1 of/)).toBeVisible();
  });

  test('arrow keys advance and go back between questions', async ({ page }) => {
    await startSampleExam(page);

    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/Slide 2 of/)).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(/Slide 1 of/)).toBeVisible();
  });

  test('shortcuts are ignored while typing in an input', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Exam details' }).click();
    await page.getByPlaceholder(CODE_PLACEHOLDER).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'MCQ Projector' })).toBeVisible();
  });

  test('reload mid-exam offers the resume dialog', async ({ page }) => {
    await startSampleExam(page);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Resume Exam?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Resume \(paused\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Use real clock/ })).toBeVisible();
  });

  test('resume returns to the paused exam', async ({ page }) => {
    await startSampleExam(page);
    await page.reload();
    await page.getByRole('button', { name: /Resume \(paused\)/ }).click();

    await expect(page.getByText(/Slide \d+ of/)).toBeVisible();
  });

  test('discard clears the saved run and returns to the start', async ({ page }) => {
    await startSampleExam(page);
    await page.reload();
    await page.getByRole('button', { name: /Discard/ }).click();

    await expect(page.getByRole('heading', { name: 'Setup Exam' })).toBeVisible();
  });
});
