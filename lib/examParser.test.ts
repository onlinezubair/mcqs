import { describe, it, expect } from 'vitest';
import { parseUnifiedExam } from '@/lib/examParser';
import { SAMPLE_COMBINED_TEXT } from '@/lib/demoQuestions';

const SAMPLE = `Program: BS Computer Science
Semester: 3
Subject: Data Structures
Subject Code: CS-201
Subject Full Name: Data Structures and Algorithms
Subject Mode: Theory
Paper: Midterm Exam
Quiz Number: 2
Date: 2024-05-10
Section A Time: 20 minutes
Section B & C Time: 40 minutes
Total Time: 60 minutes

=== SECTION A ===
1. What is an array?
a) A tree
b) A contiguous collection
c) A graph
d) A linked list
Answer: B

2. Stack follows which order?
a) FIFO
b) LIFO
c) Random
d) Priority
Answer: B

=== SECTION B ===
Q1. Explain linked lists. [10 marks]
i. Define a node. [4 marks]
ii. Compare with arrays. [6 marks]

=== SECTION C ===
Q1. Design a hash table. [15 marks]
i. Describe hashing. [7 marks]
ii. Discuss collisions. [8 marks]
`;

describe('parseUnifiedExam', () => {
  it('splits the three sections', () => {
    const result = parseUnifiedExam(SAMPLE);
    expect(result.sectionA).toHaveLength(2);
    expect(result.sectionB).toHaveLength(1);
    expect(result.sectionC).toHaveLength(1);
  });

  it('extracts metadata', () => {
    const { meta } = parseUnifiedExam(SAMPLE);
    expect(meta.subject).toBe('Data Structures');
    expect(meta.subjectCode).toBe('CS-201');
    expect(meta.examName).toBe('Midterm Exam');
    expect(meta.quizNumber).toBe(2);
    expect(meta.date).toBe('2024-05-10');
  });

  it('parses durations in minutes', () => {
    const { durations } = parseUnifiedExam(SAMPLE);
    expect(durations.totalMcqMinutes).toBe(20);
    expect(durations.paperDurationMinutes).toBe(40);
    expect(durations.totalMinutes).toBe(60);
  });

  it('warns when the total does not match the parts', () => {
    const text = SAMPLE.replace('Total Time: 60 minutes', 'Total Time: 90 minutes');
    const { issues } = parseUnifiedExam(text);
    expect(issues.some(i => i.code === 'UNIFIED_TOTAL_MISMATCH')).toBe(true);
  });

  it('parses B/C parts with marks', () => {
    const { sectionB } = parseUnifiedExam(SAMPLE);
    const q = sectionB[0]!;
    expect(q.marks).toBe(10);
    expect(q.parts).toHaveLength(2);
    expect(q.parts[0]!.marks).toBe(4);
    expect(q.parts.reduce((s, p) => s + (p.marks ?? 0), 0)).toBe(10);
  });

  it('warns on unknown metadata keys', () => {
    const text = `Unknown Key: value\n${SAMPLE}`;
    const { issues } = parseUnifiedExam(text);
    expect(issues.some(i => i.code === 'UNIFIED_UNKNOWN_KEY')).toBe(true);
  });

  it('flags missing sections', () => {
    const text = `Subject: Only A\n\n=== SECTION A ===\n1. Q?\na) 1\nb) 2\nc) 3\nd) 4\nAnswer: A\n`;
    const { issues } = parseUnifiedExam(text);
    expect(issues.some(i => i.code === 'UNIFIED_MISSING_SECTION')).toBe(true);
  });

  it('returns empty sections for empty input', () => {
    const result = parseUnifiedExam('');
    expect(result.sectionA).toEqual([]);
    expect(result.sectionB).toEqual([]);
    expect(result.sectionC).toEqual([]);
  });

  it('handles CRLF input', () => {
    const result = parseUnifiedExam(SAMPLE.replace(/\n/g, '\r\n'));
    expect(result.sectionA).toHaveLength(2);
  });

  it('warns when B parts do not sum to parent marks', () => {
    const text = SAMPLE.replace('i. Define a node. [4 marks]', 'i. Define a node. [1 marks]');
    const { issues } = parseUnifiedExam(text);
    expect(issues.some(i => i.code === 'UNIFIED_MARKS_MISMATCH')).toBe(true);
  });
});

describe('parseUnifiedExam on the bundled sample', () => {
  it('parses sections whose headers carry labels', () => {
    const result = parseUnifiedExam(SAMPLE_COMBINED_TEXT);
    expect(result.sectionA.length).toBeGreaterThan(0);
    expect(result.sectionB.length).toBeGreaterThan(0);
    expect(result.sectionC.length).toBeGreaterThan(0);
  });

  it('produces no error-severity issues', () => {
    const result = parseUnifiedExam(SAMPLE_COMBINED_TEXT);
    expect(result.issues.filter(i => i.severity === 'error')).toEqual([]);
  });

  it('extracts metadata and durations', () => {
    const { meta, durations } = parseUnifiedExam(SAMPLE_COMBINED_TEXT);
    expect(meta.subject).toBe('Data Structures');
    expect(meta.examName).toBe('Midterm Examination');
    expect(durations.totalMcqMinutes).toBe(45);
    expect(durations.paperDurationMinutes).toBe(135);
  });
});
