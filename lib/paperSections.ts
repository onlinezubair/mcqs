import type { PaperQuestion, PaperPart, Issue } from '@/types';

const QUESTION_PATTERN = /^Q?(\d+)\s*[.)\]:]?\s*(.+)$/i;
const PART_PATTERN = /^[(]?([ivx]+)[).:]?\s*(.+)$/i;
const MARKS_PATTERN = /\[\s*(\d+(?:\.\d+)?)\s*marks?\s*\]/i;

function stripMarks(text: string): string {
  return text.replace(MARKS_PATTERN, '').trim();
}

export function parsePaperSections(textB: string, textC: string): { sectionB: PaperQuestion[]; sectionC: PaperQuestion[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const sectionB = parseSection(textB, issues);
  const sectionC = parseSection(textC, issues);
  return { sectionB, sectionC, issues };
}

export function parseSection(text: string, issues: Issue[]): PaperQuestion[] {
  const lines = text.split(/\r?\n/);
  const questions: PaperQuestion[] = [];
  let currentQuestion: PaperQuestion | null = null;
  let fallbackNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;

    const pMatch = trimmed.match(PART_PATTERN);
    if (pMatch && pMatch[1] && pMatch[2] && currentQuestion) {
      const part: PaperPart = {
        label: pMatch[1].toLowerCase(),
        text: stripMarks(pMatch[2]),
      };
      const marksMatch = trimmed.match(MARKS_PATTERN);
      if (marksMatch && marksMatch[1]) {
        part.marks = parseFloat(marksMatch[1]);
      }
      currentQuestion.parts.push(part);
      continue;
    }

    const qMatch = trimmed.match(QUESTION_PATTERN);
    if (qMatch && qMatch[2]) {
      if (currentQuestion) {
        validateParts(currentQuestion, issues);
        questions.push(currentQuestion);
      }
      fallbackNumber++;
      currentQuestion = {
        number: parseInt(qMatch[1] ?? String(fallbackNumber), 10) || fallbackNumber,
        text: stripMarks(qMatch[2]),
        parts: [],
      };
      const marksMatch = trimmed.match(MARKS_PATTERN);
      if (marksMatch && marksMatch[1]) {
        currentQuestion.marks = parseFloat(marksMatch[1]);
      }
      continue;
    }
  }

  if (currentQuestion) {
    validateParts(currentQuestion, issues);
    questions.push(currentQuestion);
  }

  return questions;
}

function validateParts(question: PaperQuestion, issues: Issue[]) {
  if (question.marks !== undefined && question.parts.length > 0) {
    const sumParts = question.parts.reduce((sum, p) => sum + (p.marks ?? 0), 0);
    if (Math.abs(sumParts - question.marks) > 0.01) {
      issues.push({
        line: 0,
        severity: 'warning',
        code: 'UNIFIED_MARKS_MISMATCH',
        message: `Q${question.number} parts sum (${sumParts}) ≠ parent marks (${question.marks})`
      });
    }
  }
}
