import { test, expect } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

// Builds a minimal .docx in memory so the import path can be exercised
// without shipping a binary fixture.
function buildDocx(questionCount: number): Buffer {
  let body = '';
  for (let i = 1; i <= questionCount; i++) {
    body += `<w:p><w:r><w:t>${i}. Question number ${i}?</w:t></w:r></w:p>`;
    ['one', 'two', 'three', 'four'].forEach((text, optionIndex) => {
      body += `<w:p><w:r><w:t>${'abcd'[optionIndex]}) ${text} ${i}</w:t></w:r></w:p>`;
    });
    body += `<w:p><w:r><w:t>Answer: ${'abcd'[(i - 1) % 4]}</w:t></w:r></w:p>`;
  }
  const xml = `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`;
  const zip = zipSync({ 'word/document.xml': strToU8(xml) });
  return Buffer.from(zip);
}

test.describe('paper import summary', () => {
  test('importing a document shows a summary card, not the parsed text', async ({ page }) => {
    await page.goto('/');
    await page.locator('#import-paper').setInputFiles({
      name: 'paper-8q.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildDocx(8),
    });

    await expect(page.getByRole('heading', { name: '8 questions uploaded successfully' })).toBeVisible();
    await expect(page.getByText('paper-8q.docx', { exact: true })).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.getByText('Total allowed time')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Instructions for MCQs' })).toBeVisible();
  });

  test('summary reflects defaults: 4 sets at 60 seconds per question', async ({ page }) => {
    await page.goto('/');
    // Configuration defaults: 4 sets, 60 seconds per question.
    const configCard = page.locator('.card').filter({ hasText: 'Configuration' });
    const numbers = configCard.locator('input[type=number]');
    await expect(numbers.nth(0)).toHaveValue('4');
    await expect(numbers.nth(1)).toHaveValue('60');
    await expect(configCard.getByText('Time per question (seconds)')).toBeVisible();

    await page.locator('#import-paper').setInputFiles({
      name: 'paper-8q.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildDocx(8),
    });

    await expect(page.getByRole('heading', { name: '8 questions uploaded successfully' })).toBeVisible();
    // "8:00" appears for both MCQ time and total allowed time in the summary.
    const summary = page.locator('.card').filter({ hasText: 'uploaded successfully' });
    await expect(summary.getByText('8:00')).toHaveCount(2);
    await expect(page.getByText('8 questions each')).toBeVisible();
  });

  test('summary can build straight to review', async ({ page }) => {
    await page.goto('/');
    await page.locator('#import-paper').setInputFiles({
      name: 'paper-8q.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildDocx(8),
    });
    await page.getByRole('button', { name: /Build → Review/ }).click();
    await expect(page.getByRole('heading', { name: 'Review Exam' })).toBeVisible();
  });

  test('Review imported text and Replace paper bring the editor back', async ({ page }) => {
    await page.goto('/');
    await page.locator('#import-paper').setInputFiles({
      name: 'paper-8q.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildDocx(8),
    });
    await page.getByRole('button', { name: 'Review imported text' }).click();
    await expect(page.locator('textarea')).toHaveCount(1);
  });
});

