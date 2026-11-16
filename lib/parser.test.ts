import { describe, it, expect } from 'vitest';
import { parseMcq } from '@/lib/parser';

const VALID = `1. What is 2+2?
a) 3
b) 4
c) 5
d) 6
Answer: B

2. What is the capital of France?
a) London
b) Berlin
c) Paris
d) Madrid
Answer: C
`;

describe('parseMcq', () => {
  it('parses a valid 2-question block', () => {
    const { questions, issues } = parseMcq(VALID);
    expect(questions).toHaveLength(2);
    expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
    expect(questions[0]!.answer).toBe(1);
    expect(questions[1]!.answer).toBe(2);
    expect(questions[0]!.options[1]).toBe('4');
  });

  it('handles CRLF line endings', () => {
    const crlf = VALID.replace(/\n/g, '\r\n');
    const { questions } = parseMcq(crlf);
    expect(questions).toHaveLength(2);
  });

  it('flags a missing answer', () => {
    const text = `1. Stem?
a) 1
b) 2
c) 3
d) 4
`;
    const { issues } = parseMcq(text);
    expect(issues.some(i => i.code === 'PARSE_MISSING_ANSWER')).toBe(true);
  });

  it('flags a fifth option', () => {
    const text = `1. Stem?
a) 1
b) 2
c) 3
d) 4
e) 5
Answer: A
`;
    const { issues } = parseMcq(text);
    expect(issues.some(i => i.code === 'PARSE_FIFTH_OPTION')).toBe(true);
  });

  it('flags wrong option count', () => {
    const text = `1. Stem?
a) 1
b) 2
Answer: A
`;
    const { issues } = parseMcq(text);
    expect(issues.some(i => i.code === 'PARSE_OPTION_COUNT')).toBe(true);
  });

  it('flags an invalid answer letter', () => {
    const text = `1. Stem?
a) 1
b) 2
c) 3
d) 4
Answer: Z
`;
    const { issues } = parseMcq(text);
    expect(issues.some(i => i.code === 'PARSE_MISSING_ANSWER')).toBe(true);
  });

  it('flags duplicate stems', () => {
    const text = `1. Same stem?
a) 1
b) 2
c) 3
d) 4
Answer: A

2. Same stem?
a) 1
b) 2
c) 3
d) 4
Answer: B
`;
    const { issues } = parseMcq(text);
    expect(issues.some(i => i.code === 'PARSE_DUPLICATE_STEM')).toBe(true);
  });

  it('warns on answer skew', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => `${i + 1}. Question ${i}?
a) 1
b) 2
c) 3
d) 4
Answer: A`).join('\n\n');
    const { issues } = parseMcq(blocks);
    expect(issues.some(i => i.code === 'PARSE_ANSWER_SKEW')).toBe(true);
  });

  it('parses marks annotations', () => {
    const text = `1. Stem? [2 marks]
a) 1
b) 2
c) 3
d) 4
Answer: A
`;
    const { questions } = parseMcq(text);
    expect(questions[0]!.marks).toBe(2);
  });

  it('returns empty results for empty input', () => {
    const { questions, issues } = parseMcq('');
    expect(questions).toEqual([]);
    expect(issues).toEqual([]);
  });
});
