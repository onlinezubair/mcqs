import type { Question } from '@/types';

export const demoQuestions: Question[] = [
  {
    id: 'demo-1',
    text: 'What is the time complexity of binary search on a sorted array?',
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-2',
    text: 'Which data structure follows Last-In-First-Out (LIFO) principle?',
    options: ['Queue', 'Stack', 'Array', 'Linked List'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-3',
    text: 'In a binary search tree, what is the maximum number of children a node can have?',
    options: ['1', '2', '3', '4'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-4',
    text: 'What does "FIFO" stand for in queue data structure?',
    options: ['First In First Out', 'First In Last Out', 'Last In First Out', 'Last In Last Out'],
    answer: 0,
    marks: 1,
  },
  {
    id: 'demo-5',
    text: 'Which sorting algorithm has the best average-case time complexity?',
    options: ['Bubble Sort', 'Quick Sort', 'Merge Sort', 'Both Quick Sort and Merge Sort'],
    answer: 3,
    marks: 1,
  },
  {
    id: 'demo-6',
    text: 'What is the space complexity of a recursive factorial function?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n!)'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-7',
    text: 'In a hash table, what is a collision?',
    options: ['Two keys hash to the same index', 'A key is not found', 'The table is full', 'The hash function fails'],
    answer: 0,
    marks: 1,
  },
  {
    id: 'demo-8',
    text: 'Which traversal visits nodes in left-root-right order?',
    options: ['Preorder', 'Inorder', 'Postorder', 'Level order'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-9',
    text: 'What is the height of a balanced binary tree with n nodes?',
    options: ['O(n)', 'O(log n)', 'O(√n)', 'O(n log n)'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-10',
    text: 'Which of the following is NOT a stable sorting algorithm?',
    options: ['Merge Sort', 'Quick Sort', 'Insertion Sort', 'Bubble Sort'],
    answer: 1,
    marks: 1,
  },
  {
    id: 'demo-11',
    text: 'What is the purpose of a sentinel node in a linked list?',
    options: ['To mark the end of the list', 'To simplify edge cases', 'To store metadata', 'All of the above'],
    answer: 3,
    marks: 1,
  },
  {
    id: 'demo-12',
    text: 'In a min-heap, where is the minimum element located?',
    options: ['At the root', 'At the leftmost leaf', 'At the rightmost leaf', 'Depends on insertion order'],
    answer: 0,
    marks: 1,
  },
];

export const SAMPLE_COMBINED_TEXT = `=== EXAM METADATA ===
Program: BSc Computer Science
Semester: Fall 2024
Subject: Data Structures
Subject Code: CS201
Subject Full Name: Data Structures and Algorithms
Subject Mode: Theory
Paper: Midterm Examination
Quiz Number: 1
Date: 2024-10-15
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

Q3. In a binary search tree, max children per node? [1 mark]
a) 1
b) 2
c) 3
d) 4
Answer: b

Q4. What does FIFO stand for? [1 mark]
a) First In First Out
b) First In Last Out
c) Last In First Out
d) Last In Last Out
Answer: a

Q5. Best average-case sorting complexity? [1 mark]
a) Bubble Sort
b) Quick Sort
c) Merge Sort
d) Both Quick Sort and Merge Sort
Answer: d

=== SECTION B: DESCRIPTIVE QUESTIONS ===
Q6. Explain the difference between a stack and a queue. [5 marks]
i. Define stack and its operations [2 marks]
ii. Define queue and its operations [3 marks]

Q7. Describe how a hash table handles collisions. [5 marks]
i. Explain chaining [2 marks]
ii. Explain open addressing [3 marks]

=== SECTION C: CASE STUDY ===
Q8. A library system needs to manage books and borrowers. [15 marks]
i. Design a data structure for the catalog [5 marks]
ii. Explain how to handle concurrent borrowing [5 marks]
iii. Propose an algorithm for overdue notifications [5 marks]
`;