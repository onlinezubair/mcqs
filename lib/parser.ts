import type { Question, ParsedQuestion, Issue } from '@/types';

const MARKS_PATTERN = /\[\s*(\d+(?:\.\d+)?)\s*marks?\s*\]/i;

// Roman option labels map by position: i) ii) iii) iv). Only A-H are ever
// meaningful, so anything longer than "viii" falls through to the letter rule.
const ROMAN_OPTION_LABELS: Record<string, string> = {
  i: 'A',
  ii: 'B',
  iii: 'C',
  iv: 'D',
  v: 'E',
  vi: 'F',
  vii: 'G',
  viii: 'H',
};

function normalizeOptionLabel(raw: string): string | null {
  const mapped = ROMAN_OPTION_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  if (/^[A-Za-z]$/.test(raw)) return raw.toUpperCase();
  return null;
}

// "1. ", "2) ", "(3) ", "Q4) ", "Question 5: " — a leading numbering prefix
// only. Requires trailing whitespace so "1.5 is ..." is left untouched.
const QUESTION_START =
  /^(?:\(\s*\d+\s*\)\s*|\d+\s*[).:]\s+|q(?:uestion)?\.?\s*\(?\d+\)?\s*[).:]?\s+)/i;

function stripQuestionNumbering(text: string): string {
  return text.replace(QUESTION_START, '').trim();
}

interface MatchedOption {
  letter: string;
  text: string;
}

function matchOptionLine(line: string): MatchedOption | null {
  let match = line.match(/^\(\s*([A-Za-z]{1,4})\s*\)\s*(.+)$/);
  if (!match) match = line.match(/^([A-Za-z]{1,4})\s*[).:]\s*(.+)$/);
  if (!match) return null;
  const letter = normalizeOptionLabel(match[1] ?? '');
  if (!letter) return null;
  return { letter, text: (match[2] ?? '').trim() };
}

function matchAnswerLine(line: string): string | null {
  let match = line.match(/^\*\s*\(?\s*([A-Za-z]{1,4})\s*\)?\s*$/);
  if (match) return match[1] ?? null;
  match = line.match(/^(?:answer|ans|correct)\s*[:.=]\s*\(?\s*([A-Za-z]{1,4})\s*\)?/i);
  if (match) return match[1] ?? null;
  return null;
}

interface RawLine {
  line: number;
  text: string;
}

// Blank lines are the primary separator, but papers extracted from Word or PDF
// often lose blank lines and keep only "1." / "Q2)" numbering. A numbered line
// that arrives after a block already has two options starts a new question.
function splitBlocks(raw: string): RawLine[][] {
  const blocks: RawLine[][] = [];
  let current: RawLine[] = [];
  let optionCount = 0;

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current);
      current = [];
      optionCount = 0;
    }
  };

  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = (lines[i] ?? '').trim();
    if (!text) {
      flush();
      continue;
    }
    if (optionCount >= 2 && QUESTION_START.test(text)) flush();
    current.push({ line: i + 1, text });
    if (matchOptionLine(text)) optionCount++;
  }
  flush();

  return blocks;
}

export function parseMcq(text: string): { questions: Question[]; issues: Issue[] } {
  const blocks = splitBlocks(text);
  const questions: ParsedQuestion[] = [];
  const issues: Issue[] = [];
  let rawIndex = 0;

  for (const block of blocks) {
    const startLine = block[0]?.line ?? 0;
    const stemLines: string[] = [];
    const options: string[] = [];
    let rawAnswer: string | null = null;

    for (const { line, text: lineText } of block) {
      const answer = matchAnswerLine(lineText);
      if (answer) {
        if (rawAnswer === null) rawAnswer = answer;
        continue;
      }

      const option = matchOptionLine(lineText);
      if (option) {
        if (options.length >= 4) {
          issues.push({
            line,
            severity: 'error',
            code: 'PARSE_FIFTH_OPTION',
            message: 'Found a fifth option (only four are supported)',
          });
          continue;
        }
        options.push(option.text);
        continue;
      }

      if (options.length > 0) {
        const lastIndex = options.length - 1;
        options[lastIndex] = `${options[lastIndex]} ${lineText}`.trim();
      } else {
        stemLines.push(lineText);
      }
    }

    const joinedStem = stemLines.join(' ');
    const marksMatch = joinedStem.match(MARKS_PATTERN);
    const marks = marksMatch?.[1] ? parseFloat(marksMatch[1]) : 1;
    const stem = stripQuestionNumbering(joinedStem.replace(MARKS_PATTERN, '')).trim();

    let answerIndex: 0 | 1 | 2 | 3 | undefined;
    if (rawAnswer) {
      const mapped = normalizeOptionLabel(rawAnswer) ?? rawAnswer.toUpperCase();
      const idx = 'ABCD'.indexOf(mapped);
      if (idx >= 0 && idx < options.length) {
        answerIndex = idx as 0 | 1 | 2 | 3;
      } else {
        issues.push({
          line: startLine,
          severity: 'error',
          code: 'PARSE_MISSING_ANSWER',
          message: `Invalid answer letter: ${rawAnswer}`,
        });
      }
    }

    if (!stem) {
      issues.push({
        line: startLine,
        severity: 'error',
        code: 'PARSE_EMPTY_STEM',
        message: 'Empty question stem',
      });
    }

    if (options.length !== 4) {
      issues.push({
        line: startLine,
        severity: 'error',
        code: 'PARSE_OPTION_COUNT',
        message: `Expected 4 options, found ${options.length}`,
      });
    }

    if (rawAnswer === null) {
      issues.push({
        line: startLine,
        severity: 'error',
        code: 'PARSE_MISSING_ANSWER',
        message: 'Missing or invalid answer',
      });
    }

    if (stem && options.length === 4 && answerIndex !== undefined) {
      rawIndex++;
      questions.push({
        id: `q-${rawIndex}-${startLine}`,
        text: stem,
        options: options as [string, string, string, string],
        answer: answerIndex,
        marks,
        rawIndex,
        line: startLine,
      });
    }
  }

  const seenStems = new Map<string, number>();
  questions.forEach(q => {
    const key = q.text.toLowerCase().slice(0, 100);
    const previous = seenStems.get(key);
    if (previous !== undefined) {
      issues.push({
        line: q.line,
        severity: 'warning',
        code: 'PARSE_DUPLICATE_STEM',
        message: `Duplicate stem (also at line ${previous})`,
      });
    } else {
      seenStems.set(key, q.line);
    }

    const optionSet = new Set(q.options.map(option => option.toLowerCase()));
    if (optionSet.size < 4) {
      issues.push({
        line: q.line,
        severity: 'warning',
        code: 'PARSE_DUPLICATE_OPTION',
        message: 'Duplicate option text within question',
      });
    }

    if (q.text.length > 500) {
      issues.push({
        line: q.line,
        severity: 'warning',
        code: 'PARSE_LONG_STEM',
        message: 'Question stem is very long (>500 chars)',
      });
    }

    q.options.forEach((option, j) => {
      if (option.length > 200) {
        issues.push({
          line: q.line,
          severity: 'warning',
          code: 'PARSE_LONG_OPTION',
          message: `Option ${'ABCD'[j]} is very long (>200 chars)`,
        });
      }
    });
  });

  const answerCounts: number[] = [0, 0, 0, 0];
  questions.forEach(q => {
    answerCounts[q.answer] = (answerCounts[q.answer] ?? 0) + 1;
  });

  const total = questions.length;
  if (total > 10) {
    const expected = total / 4;
    answerCounts.forEach((count, i) => {
      if (Math.abs(count - expected) > expected * 0.5) {
        issues.push({
          line: 0,
          severity: 'warning',
          code: 'PARSE_ANSWER_SKEW',
          message: `Answer '${'ABCD'[i]}' appears ${count} times (expected ~${Math.round(expected)})`,
        });
      }
    });
  }

  return { questions, issues };
}
