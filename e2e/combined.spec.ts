import { test, expect } from '@playwright/test';
import { fillMeta } from './helpers';

// The bundled sample has 5 MCQs, and every set contains all of them, so a
// full MCQ run is always 5 positions regardless of how many sets exist.
const SAMPLE_MCQ_COUNT = 5;

async function buildSampleExam(page: import('@playwright/test').Page) {
  await fillMeta(page);
  await page.getByRole('button', { name: 'Load Sample' }).click();
  await page.getByRole('button', { name: /Build/ }).click();
}

async function startSampleRun(page: import('@playwright/test').Page) {
  await buildSampleExam(page);
  await page.getByRole('button', { name: /Calibrate/ }).click();
  await page.getByRole('button', { name: /Start Exam/ }).click();
  await expect(page.getByText(/Question 1 of/)).toBeVisible();
}

test.describe('combined exam flow', () => {
  test('review screen shows Section B and C from the sample', async ({ page }) => {
    await buildSampleExam(page);
    await expect(page.getByRole('heading', { name: 'Review Exam' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Section B \(Descriptive\)/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Section C \(Case Study\)/ })).toBeVisible();
  });

  test('advancing past the last MCQ shows the Section B & C intro', async ({ page }) => {
    await startSampleRun(page);

    for (let i = 0; i < SAMPLE_MCQ_COUNT; i++) {
      await page.keyboard.press('ArrowRight');
    }

    await expect(page.getByRole('heading', { name: /Section A Complete/ })).toBeVisible();
  });

  test('paper screen renders both sections and can end the exam', async ({ page }) => {
    await startSampleRun(page);

    for (let i = 0; i < SAMPLE_MCQ_COUNT; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.getByRole('button', { name: /Start Section B & C/ }).click();

    await expect(page.getByRole('heading', { name: /^Section B/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Section C/ })).toBeVisible();

    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'End Exam' }).click();
    await expect(page.getByRole('heading', { name: 'Exam Complete' })).toBeVisible();
  });

  test('end screen exposes print and zip export controls', async ({ page }) => {
    await startSampleRun(page);

    for (let i = 0; i < SAMPLE_MCQ_COUNT; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.getByRole('button', { name: /Start Section B & C/ }).click();
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'End Exam' }).click();

    await expect(page.getByRole('button', { name: /Download ZIP/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Print Answer Key/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Answer Review Mode/ })).toBeVisible();
  });
});
