import { describe, it, expect } from 'vitest';
import { parseMcq } from './parser';

const BASE = `1. Stem?
a) one
b) two
c) three
d) four
Answer: B`;

describe('parseMcq tolerant layouts', () => {
  it('accepts parentheses option labels', () => {
    const text = `1. Stem?
(a) one
(b) two
(c) three
(d) four
Answer: (b)`;
    const { questions, issues } = parseMcq(text);
    expect(questions).toHaveLength(1);
    expect(questions[0]!.answer).toBe(1);
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  });

  it('accepts dot and colon option labels', () => {
    const text = `1. Stem?
A. one
B. two
C. three
D. four
Answer: C`;
    const { questions } = parseMcq(text);
    expect(questions[0]!.answer).toBe(2);
    expect(questions[0]!.options[2]).toBe('three');
  });

  it('maps roman-numeral option labels by position', () => {
    const text = `1. Stem?
i) one
ii) two
iii) three
iv) four
Answer: iv`;
    const { questions } = parseMcq(text);
    expect(questions[0]!.answer).toBe(3);
    expect(questions[0]!.options).toEqual(['one', 'two', 'three', 'four']);
  });

  it('accepts the *B answer shorthand', () => {
    const text = `1. Stem?
a) one
b) two
c) three
d) four
*B`;
    const { questions } = parseMcq(text);
    expect(questions[0]!.answer).toBe(1);
  });

  it('splits questions with no blank lines between them', () => {
    const text = `1. First?
a) one
b) two
c) three
d) four
Answer: A
2. Second?
a) one
b) two
c) three
d) four
Answer: B`;
    const { questions } = parseMcq(text);
    expect(questions).toHaveLength(2);
    expect(questions[0]!.text).toBe('First?');
    expect(questions[1]!.text).toBe('Second?');
  });

  it('strips Q-prefixed numbering prefixes', () => {
    const text = `Question 1) First?
a) one
b) two
c) three
d) four
Answer: A`;
    const { questions } = parseMcq(text);
    expect(questions[0]!.text).toBe('First?');
  });

  it('joins wrapped option text onto the previous option', () => {
    const text = `1. Stem?
a) one
b) two
c) three
d) four continued here
Answer: D`;
    const { questions } = parseMcq(text);
    expect(questions[0]!.options[3]).toBe('four continued here');
  });

  it('keeps line numbers on issues', () => {
    const text = `1. Stem?
a) one
b) two
Answer: A`;
    const { issues } = parseMcq(text);
    const optionIssue = issues.find(i => i.code === 'PARSE_OPTION_COUNT');
    expect(optionIssue?.line).toBe(1);
  });

  it('reports a duplicate stem with the earlier line', () => {
    const text = `${BASE}

2. Stem?
a) one
b) two
c) three
d) four
Answer: A`;
    const { issues } = parseMcq(text);
    const duplicate = issues.find(i => i.code === 'PARSE_DUPLICATE_STEM');
    expect(duplicate?.line).toBe(8);
    expect(duplicate?.message).toContain('also at line 1');
  });
});
