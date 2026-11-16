import type { ExamMeta, Question, PaperQuestion, Issue } from '@/types';
import { parseMcq } from './parser';
import { parseSection } from './paperSections';
import { parseDuration } from './time';

interface UnifiedParseResult {
  meta: Partial<ExamMeta>;
  durations: { totalMcqMinutes: number; paperDurationMinutes: number; totalMinutes: number };
  sectionAText: string;
  sectionBText: string;
  sectionCText: string;
  sectionA: Question[];
  sectionB: PaperQuestion[];
  sectionC: PaperQuestion[];
  issues: Issue[];
}

const SECTION_REGEX = /^=+\s*SECTION\s*([ABC])\b[^=]*=*\s*$/i;
const METADATA_REGEX = /^([^:]+):\s*(.+)$/;

export function parseUnifiedExam(text: string): UnifiedParseResult {
  const lines = text.split(/\r?\n/);
  const sections: Record<string, string[]> = { A: [], B: [], C: [] };
  const metadata: Record<string, string> = {};
  let currentSection: 'A' | 'B' | 'C' | 'META' = 'META';
  const issues: Issue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const lineNum = i + 1;
    const trimmed = line.trim();

    const sectionMatch = trimmed.match(SECTION_REGEX);
    if (sectionMatch) {
      const sect = sectionMatch[1]?.toUpperCase() as 'A' | 'B' | 'C' | undefined;
      if (sect === 'A' || sect === 'B' || sect === 'C') {
        currentSection = sect;
      }
      continue;
    }

    if (currentSection === 'META') {
      const metaMatch = trimmed.match(METADATA_REGEX);
      if (metaMatch && metaMatch[1] && metaMatch[2]) {
        metadata[metaMatch[1].trim().toLowerCase()] = metaMatch[2].trim();
      }
      continue;
    }

    const sectionArr = sections[currentSection];
    if (sectionArr && line !== undefined) {
      sectionArr.push(line);
    }
  }

  const meta = mapMetadata(metadata, issues);

  const durations = parseDurations(metadata, issues);

  const sectionAText = sections.A?.join('\n').trim() ?? '';
  const sectionBText = sections.B?.join('\n').trim() ?? '';
  const sectionCText = sections.C?.join('\n').trim() ?? '';

  let sectionA: Question[] = [];
  if (sectionAText) {
    const result = parseMcq(sectionAText);
    sectionA = result.questions;
    issues.push(...result.issues.map(iss => ({ ...iss, line: iss.line })));
  }

  const sectionB = parseSection(sectionBText, issues);
  const sectionC = parseSection(sectionCText, issues);

  if (sectionA.length === 0) {
    issues.push({ line: 0, severity: 'warning', code: 'UNIFIED_MISSING_SECTION', message: 'Section A (MCQs) is empty' });
  }
  if (sectionB.length === 0) {
    issues.push({ line: 0, severity: 'warning', code: 'UNIFIED_MISSING_SECTION', message: 'Section B is empty' });
  }
  if (sectionC.length === 0) {
    issues.push({ line: 0, severity: 'warning', code: 'UNIFIED_MISSING_SECTION', message: 'Section C is empty' });
  }

  return {
    meta,
    durations,
    sectionAText,
    sectionBText,
    sectionCText,
    sectionA,
    sectionB,
    sectionC,
    issues,
  };
}

function mapMetadata(metadata: Record<string, string>, issues: Issue[]): Partial<ExamMeta> {
  const mapping: Record<string, keyof ExamMeta> = {
    program: 'program',
    semester: 'semester',
    subject: 'subject',
    'subject code': 'subjectCode',
    'subject full name': 'subjectFullName',
    'subject mode': 'subjectMode',
    paper: 'examName',
    exam: 'examName',
    'quiz number': 'quizNumber',
    date: 'date',
  };

  const result: Partial<ExamMeta> = {};
  Object.entries(metadata).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (mapping[lowerKey]) {
      const targetKey = mapping[lowerKey];
      if (lowerKey === 'quiz number') {
        (result as Record<string, unknown>)[targetKey] = parseInt(value, 10) || 0;
      } else if (lowerKey === 'date') {
        (result as Record<string, unknown>)[targetKey] = value;
      } else {
        (result as Record<string, string>)[targetKey] = value;
      }
    } else {
      issues.push({ line: 0, severity: 'warning', code: 'UNIFIED_UNKNOWN_KEY', message: `Unknown metadata key: ${key}` });
    }
  });
  return result;
}

function parseDurations(metadata: Record<string, string>, issues: Issue[]): UnifiedParseResult['durations'] {
  let totalMcqMinutes = 0;
  let paperDurationMinutes = 0;
  let totalMinutes = 0;

  const parseTimeValue = (value: string): number => {
    const parsed = parseDuration(value);
    return parsed !== null ? parsed / 60 : 0;
  };

  Object.entries(metadata).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'section a time' || lowerKey === 'section a minutes') {
      totalMcqMinutes = parseTimeValue(value);
    } else if (lowerKey === 'section b & c time' || lowerKey === 'section b and c time' || lowerKey === 'section b&c time') {
      paperDurationMinutes = parseTimeValue(value);
    } else if (lowerKey === 'total time' || lowerKey === 'total minutes') {
      totalMinutes = parseTimeValue(value);
    }
  });

  const expectedTotal = totalMcqMinutes + paperDurationMinutes;
  if (totalMinutes > 0 && Math.abs(totalMinutes - expectedTotal) > 1) {
    issues.push({
      line: 0,
      severity: 'warning',
      code: 'UNIFIED_TOTAL_MISMATCH',
      message: `Total time (${totalMinutes} min) ≠ Section A (${totalMcqMinutes} min) + Section B&C (${paperDurationMinutes} min)`
    });
  }

  return { totalMcqMinutes, paperDurationMinutes, totalMinutes };
}