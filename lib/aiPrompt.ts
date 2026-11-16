export function buildAiPromptText(mode: 'mcq' | 'combined'): string {
  const basePrompt = `You are an exam author. Produce a formatted exam text that can be pasted directly into MCQ Projector.

FORMAT RULES:
- Metadata block (optional but recommended):
  Program: [program name]
  Semester: [semester]
  Subject: [subject name]
  Subject Code: [code]
  Subject Full Name: [full name]
  Subject Mode: [mode]
  Paper: [exam name]
  Quiz Number: [integer]
  Date: [YYYY-MM-DD]

- Section A (MCQs) - REQUIRED:
  Use this format for each question:
  Q1. Question text here? [N mark(s)]
  a) Option A
  b) Option B
  c) Option C
  d) Option D
  Answer: b

  Rules:
  - Number questions 1, 2, 3... (or Q1., Q1), etc.)
  - Exactly 4 options labeled a) b) c) d) (case-insensitive)
  - Answer line: "Answer: b" or "Ans: B" or "Correct: C"
  - Marks in brackets: [1 mark], [2 marks], [0.5 mark(s)]
  - Multi-line stems and options are allowed
  - Blank lines are ignored

`;

  if (mode === 'combined') {
    return basePrompt + `
- Section B (Descriptive) - REQUIRED for combined mode:
  Q1. Descriptive question text [N mark(s)]
  i. Sub-part text [N mark(s)]
  ii. Sub-part text [N mark(s)]

- Section C (Case Study) - REQUIRED for combined mode:
  Q1. Case study text [N mark(s)]
  i. Sub-part text [N mark(s)]
  ii. Sub-part text [N mark(s)]

  Rules for B & C:
  - Number questions continuing from Section A or starting fresh
  - Parts labeled i. ii. iii. (lowercase roman numerals)
  - Part marks in brackets optional; should sum to parent question marks

=== EXAMPLE COMBINED EXAM ===

=== EXAM METADATA ===
Program: BSc Computer Science
Paper: Midterm Exam
Subject: Data Structures
Subject Code: CS201
Total Time: 3 hours
Section A Time: 45 minutes
Section B & C Time: 2 hours 15 minutes

=== SECTION A: MCQs ===
Q1. What is the time complexity of binary search? [1 mark]
a) O(n)
b) O(log n)
c) O(n log n)
d) O(1)
Answer: b

Q2. Which data structure uses LIFO? [1 mark]
a) Queue
b) Stack
c) Array
d) Linked List
Answer: b

=== SECTION B: DESCRIPTIVE QUESTIONS ===
Q3. Explain the difference between a stack and a queue. [5 marks]
i. Define stack and its operations [2 marks]
ii. Define queue and its operations [3 marks]

=== SECTION C: CASE STUDY ===
Q4. A library system needs to manage books and borrowers. [10 marks]
i. Design a data structure for the catalog [4 marks]
ii. Explain how to handle concurrent borrowing [6 marks]

`;
  }

  return basePrompt + `
=== EXAMPLE MCQ-ONLY EXAM ===

=== EXAM METADATA ===
Program: BSc Computer Science
Paper: Quiz 1
Subject: Data Structures
Quiz Number: 1

=== SECTION A: MCQs ===
Q1. What is the time complexity of binary search? [1 mark]
a) O(n)
b) O(log n)
c) O(n log n)
d) O(1)
Answer: b

Q2. Which data structure uses LIFO? [1 mark]
a) Queue
b) Stack
c) Array
d) Linked List
Answer: b

`;
}