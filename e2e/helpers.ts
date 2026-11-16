import type { Page } from '@playwright/test';

export const CODE_PLACEHOLDER = 'e.g., 310 — fills semester and subject automatically';

// Opens the opt-in "Exam details" screen from Setup, then fills the metadata
// shortcut (310 = Physical Pharmacy-I, Semester 1).
export async function fillMeta(page: Page, examName = 'Midterm') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Exam details' }).click();
  await page.getByPlaceholder(CODE_PLACEHOLDER).fill('310');
  await page.locator('#metaExamName').selectOption(examName);
  await page.getByRole('button', { name: /Continue/ }).click();
}
