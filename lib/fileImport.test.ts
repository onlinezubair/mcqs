// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  delimitedToMcqText,
  docxToText,
  extractQuestionsText,
  odtToText,
  rtfToText,
  xlsxToDelimited,
} from './fileImport';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('file import', () => {
  it('maps a headered CSV question bank to the plain-text format', () => {
    const csv = [
      'Question,Option A,Option B,Option C,Correct Answer',
      'What is 2+2?,3,4,5,B',
      'Capital of France?,Paris,Rome,Madrid,A',
    ].join('\n');
    const out = delimitedToMcqText(csv, 'bank.csv');
    expect(out).toContain('What is 2+2?\nA) 3\nB) 4\nC) 5\nAnswer: B');
    expect(out).toContain('Capital of France?\nA) Paris\nB) Rome\nC) Madrid\nAnswer: A');
  });

  it('maps a TSV with bare letter headers', () => {
    const tsv = ['Question\tA\tB\tC\tAnswer', 'Pick one\tRed\tGreen\tBlue\tC'].join('\n');
    const out = delimitedToMcqText(tsv, 'bank.tsv');
    expect(out).toContain('Pick one\nA) Red\nB) Green\nC) Blue\nAnswer: C');
  });

  it('uses positional columns when no header is recognized', () => {
    const csv = ['What is 2+2?,3,4,5,B', 'Name a colour,Red,Green,,'].join('\n');
    const out = delimitedToMcqText(csv, 'bank.csv');
    expect(out).toContain('What is 2+2?\nA) 3\nB) 4\nC) 5\nAnswer: B');
    expect(out).toContain('Name a colour\nA) Red\nB) Green');
  });

  it('strips RTF control words and keeps paragraph breaks', () => {
    const out = rtfToText('{\\rtf1\\ansi What is 2+2?\\par A) 3\\par B) 4\\par Answer: B}');
    expect(out).toBe('What is 2+2?\nA) 3\nB) 4\nAnswer: B');
  });

  it('extracts paragraphs from a .docx package', () => {
    const xml =
      '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>What is 2+2?</w:t></w:r></w:p><w:p><w:r><w:t>A) 3</w:t></w:r></w:p><w:p><w:r><w:t>B) 4</w:t></w:r></w:p></w:body></w:document>';
    const zip = zipSync({ 'word/document.xml': strToU8(xml) });
    expect(docxToText(asArrayBuffer(zip))).toBe('What is 2+2?\nA) 3\nB) 4');
  });

  it('extracts text from an .odt package', () => {
    const xml =
      '<office:document-content><text:p>What is 2+2?</text:p><text:p>A) 3</text:p><text:p>B) 4</text:p></office:document-content>';
    const zip = zipSync({ 'content.xml': strToU8(xml) });
    expect(odtToText(asArrayBuffer(zip))).toBe('What is 2+2?\nA) 3\nB) 4');
  });

  it('extracts rows from a .xlsx worksheet', () => {
    const sheet =
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>4</v></c></row></sheetData></worksheet>';
    const shared =
      '<sst><si><t>Question</t></si><si><t>Answer</t></si><si><t>What is 2+2?</t></si></sst>';
    const zip = zipSync({
      'xl/worksheets/sheet1.xml': strToU8(sheet),
      'xl/sharedStrings.xml': strToU8(shared),
    });
    expect(xlsxToDelimited(asArrayBuffer(zip))).toBe('Question\tAnswer\nWhat is 2+2?\t4');
  });

  it('reads a browsed plain-text file end-to-end', async () => {
    const file = new File(['What is 2+2?\nA) 3\nB) 4\nAnswer: B'], 'exam.txt', {
      type: 'text/plain',
    });
    await expect(extractQuestionsText(file)).resolves.toContain('What is 2+2?');
  });

  it('rejects legacy .doc and .xls with a helpful message', async () => {
    const doc = new File(['x'], 'old.doc', { type: 'application/msword' });
    await expect(extractQuestionsText(doc)).rejects.toThrow(/Re-save the paper as \.docx/);
    const xls = new File(['x'], 'old.xls', { type: 'application/vnd.ms-excel' });
    await expect(extractQuestionsText(xls)).rejects.toThrow(/Re-save the paper as \.xlsx/);
  });

  it('rejects an empty text file', async () => {
    const file = new File(['   \n\n '], 'empty.txt', { type: 'text/plain' });
    await expect(extractQuestionsText(file)).rejects.toThrow(/No readable text/);
  });
});
