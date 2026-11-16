import { describe, it, expect } from 'vitest';
import { escapeHtml, safeFilename, csvCell, buildCsv } from '@/lib/escape';

describe('escapeHtml', () => {
  it('escapes all HTML-sensitive characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("A & B's")).toBe('A &amp; B&#39;s');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123');
  });
});

describe('safeFilename', () => {
  it('replaces Windows-reserved characters', () => {
    expect(safeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('prefixes reserved device names', () => {
    expect(safeFilename('CON')).toBe('_CON');
    expect(safeFilename('nul')).toBe('_nul');
    expect(safeFilename('COM1')).toBe('_COM1');
  });

  it('replaces trailing dot', () => {
    expect(safeFilename('file.')).toBe('file_');
  });

  it('strips control characters', () => {
    expect(safeFilename('a\u0001b\u001fc')).toBe('abc');
  });

  it('truncates to max length', () => {
    const long = 'x'.repeat(300);
    expect(safeFilename(long, 50)).toHaveLength(50);
  });

  it('falls back to untitled when empty', () => {
    expect(safeFilename('')).toBe('untitled');
    expect(safeFilename('   ')).toBe('untitled');
  });
});

describe('csvCell', () => {
  it('quotes cells containing commas or quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('neutralises formula injection prefixes', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('quotes cells that still need RFC 4180 quoting after neutralising', () => {
    expect(csvCell('=1,2')).toBe("\"'=1,2\"");
  });

  it('leaves plain text alone', () => {
    expect(csvCell('hello')).toBe('hello');
  });
});

describe('buildCsv', () => {
  it('prepends a UTF-8 BOM and joins with CRLF', () => {
    const csv = buildCsv([['a', 'b'], ['c', 'd']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1)).toBe('a,b\r\nc,d');
  });
});
