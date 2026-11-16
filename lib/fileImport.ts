// Client-side question-paper importers. Every supported document format is
// converted to the same plain-text MCQ layout the app's parser already
// understands (lib/parser.ts, lib/examParser.ts), so browsing a paper never
// dumps raw binary into the textarea.
//
// Everything runs in the browser: .docx/.odt/.xlsx are unzipped with fflate,
// PDF text is read with pdfjs-dist (lazy-loaded), and spreadsheets/CSV are
// mapped by header where possible.

import { strFromU8, unzipSync } from 'fflate';

export const ACCEPTED_QUESTION_FILE_TYPES =
  '.txt,.text,.md,.markdown,.csv,.tsv,.docx,.pdf,.rtf,.odt,.xlsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export class FileImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileImportError';
  }
}

function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? (match[1] ?? '').toLowerCase() : '';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function unzip(buffer: ArrayBuffer): Record<string, Uint8Array> {
  try {
    return unzipSync(new Uint8Array(buffer));
  } catch {
    throw new FileImportError(
      'The file could not be opened — it may be damaged or saved in an older format. Try re-saving it as .docx, .pdf, .xlsx or .csv.',
    );
  }
}

// ---------------------------------------------------------------- Word .docx

export function docxToText(buffer: ArrayBuffer): string {
  const zip = unzip(buffer);
  const documentXml = zip['word/document.xml'];
  if (!documentXml) {
    throw new FileImportError('No document text found in this .docx file.');
  }
  const xml = strFromU8(documentXml)
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n');
  const text = xml.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_, inner: string) =>
    decodeXmlEntities(inner),
  );
  return tidy(text.replace(/<[^>]+>/g, ''));
}

// ---------------------------------------------------------------- Writer .odt

export function odtToText(buffer: ArrayBuffer): string {
  const zip = unzip(buffer);
  const contentXml = zip['content.xml'];
  if (!contentXml) {
    throw new FileImportError('No document text found in this .odt file.');
  }
  const xml = strFromU8(contentXml)
    .replace(/<text:s\b([^>]*)\/>/g, (_, attrs: string) => {
      const count = parseInt(/text:c="(\d+)"/.exec(attrs)?.[1] ?? '1', 10);
      return ' '.repeat(Number.isFinite(count) ? count : 1);
    })
    .replace(/<text:tab\b[^>]*\/>/g, '\t')
    .replace(/<text:line-break\b[^>]*\/>/g, '\n')
    .replace(/<\/(?:text:p|text:h)>/g, '\n');
  return tidy(decodeXmlEntities(xml.replace(/<[^>]+>/g, '')));
}

// -------------------------------------------------------------------- RTF

export function rtfToText(rtf: string): string {
  let out = rtf
    .replace(/\\par\b ?/g, '\n')
    .replace(/\\line\b ?/g, '\n')
    .replace(/\\tab\b ?/g, '\t')
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)));
  out = out.replace(/\\[a-z]+-?\d*\s?/gi, '');
  out = out.replace(/\\([\\{}])/g, '$1');
  out = out.replace(/[{}]/g, '');
  return tidy(out);
}

// ------------------------------------------------------- CSV / TSV / .xlsx

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string, fileName: string): string {
  if (/\.tsv$/i.test(fileName)) return '\t';
  const firstLine = text.split('\n', 1)[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  if (tabs > commas && tabs >= semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

interface ColumnMapping {
  question: number;
  options: number[];
  answer: number;
}

const QUESTION_HEADER = /^(?:question|questions|question text|prompt|stem|item|q)$/;
const ANSWER_HEADER =
  /^(?:answer|ans|correct|correct answer|correct option|answer key|right answer|key|solution)$/;
const OPTION_HEADER = /^(?:option|opt|choice|answer)\s*([a-h1-8])$/;

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._\-/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function buildColumnMapping(header: string[]): ColumnMapping | null {
  let question = -1;
  let answer = -1;
  const options: { index: number; rank: number }[] = [];
  const seen = new Set<number>();

  header.forEach((cell, index) => {
    const name = normalizeHeader(cell);
    if (question < 0 && QUESTION_HEADER.test(name)) question = index;
    if (answer < 0 && ANSWER_HEADER.test(name)) answer = index;
    const match = OPTION_HEADER.exec(name);
    if (match) {
      const token = match[1] ?? '';
      const rank = /[a-h]/.test(token) ? token.charCodeAt(0) - 97 : parseInt(token, 10) - 1;
      options.push({ index, rank });
      seen.add(index);
    }
  });

  // Bare "A", "B", "C"... headers are common in exported banks.
  if (question >= 0) {
    header.forEach((cell, index) => {
      const name = normalizeHeader(cell);
      if (/^[a-h]$/.test(name) && !seen.has(index) && index !== answer) {
        options.push({ index, rank: name.charCodeAt(0) - 97 });
        seen.add(index);
      }
    });
  }

  if (question < 0 || options.length < 2) return null;
  options.sort((a, b) => a.rank - b.rank);
  return { question, options: options.map(o => o.index), answer };
}

function answerLetter(value: string, optionTexts: string[]): string | null {
  const cleaned = value
    .trim()
    .replace(/^option\s+/i, '')
    .replace(/^\(|\)$/g, '')
    .trim();
  if (/^[A-Ha-h]$/.test(cleaned)) return cleaned.toUpperCase();
  if (/^[1-8]$/.test(cleaned)) return LETTERS[parseInt(cleaned, 10) - 1] ?? null;
  const index = optionTexts.findIndex(text => text.toLowerCase() === value.trim().toLowerCase());
  return index >= 0 ? (LETTERS[index] ?? null) : null;
}

function rowsToBlocks(rows: string[][], mapping: ColumnMapping): string {
  const blocks: string[] = [];
  for (const row of rows) {
    const question = (row[mapping.question] ?? '').trim();
    if (!question) continue;
    const options = mapping.options.map(i => (row[i] ?? '').trim()).filter(Boolean);
    if (options.length < 2) continue;

    const lines = [question];
    options.forEach((text, i) => lines.push(`${LETTERS[i]}) ${text}`));
    const rawAnswer = mapping.answer >= 0 ? (row[mapping.answer] ?? '').trim() : '';
    const letter = rawAnswer ? answerLetter(rawAnswer, options) : null;
    if (letter && options.length > LETTERS.indexOf(letter)) lines.push(`Answer: ${letter}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

export function delimitedToMcqText(text: string, fileName = ''): string {
  const clean = stripBom(text).trim();
  if (!clean) return '';
  const delimiter = detectDelimiter(clean, fileName);
  const rows = parseDelimited(clean, delimiter).filter(row => row.some(cell => cell.trim() !== ''));
  if (rows.length === 0) return '';

  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const mapping = buildColumnMapping(rows[i] ?? []);
    if (mapping) {
      const converted = rowsToBlocks(rows.slice(i + 1), mapping);
      if (converted.trim()) return converted;
    }
  }

  // No recognizable header — assume: question, options..., answer.
  const blocks: string[] = [];
  for (const row of rows) {
    const cells = row.map(cell => cell.trim());
    if (!cells[0] || cells.length < 3) continue;
    let optionCells = cells.slice(1);
    let letter: string | null = null;
    const last = optionCells[optionCells.length - 1] ?? '';
    const optionCellsWithoutLast = optionCells.slice(0, -1).filter(Boolean);
    if (optionCellsWithoutLast.length >= 2 && /^(?:[A-Ha-h]|[1-8])$/.test(last)) {
      letter = answerLetter(last, optionCellsWithoutLast);
      optionCells = optionCellsWithoutLast;
    }
    optionCells = optionCells.filter(Boolean);
    if (optionCells.length < 2) continue;
    const lines = [cells[0] ?? ''];
    optionCells.forEach((text, i) => lines.push(`${LETTERS[i]}) ${text}`));
    if (letter) lines.push(`Answer: ${letter}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

export function xlsxToDelimited(buffer: ArrayBuffer): string {
  const zip = unzip(buffer);
  const sheetName = Object.keys(zip).find(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) {
    throw new FileImportError('No worksheet found in this .xlsx file.');
  }
  const sheetXml = strFromU8(zip[sheetName]!);
  const sharedXml = zip['xl/sharedStrings.xml'];
  const shared = sharedXml ? parseSharedStrings(strFromU8(sharedXml)) : [];

  const lines: string[] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheetXml))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let fallbackIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1] ?? ''))) {
      const attrs = cellMatch[1] ?? '';
      const inner = cellMatch[2] ?? '';
      const ref = /\br="([^"]+)"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : fallbackIndex;
      fallbackIndex = index + 1;
      const value = xlsxCellValue(attrs, inner, shared);
      while (cells.length < index) cells.push('');
      cells[index] = value;
    }
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRe.exec(xml))) {
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRe.exec(siMatch[1] ?? ''))) parts.push(decodeXmlEntities(tMatch[1] ?? ''));
    strings.push(parts.join(''));
  }
  return strings;
}

function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/i.exec(ref)?.[1];
  if (!letters) return 0;
  let index = 0;
  for (const ch of letters.toUpperCase()) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function xlsxCellValue(attrs: string, inner: string, shared: string[]): string {
  const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
  if (type === 'inlineStr') {
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRe.exec(inner))) parts.push(decodeXmlEntities(tMatch[1] ?? ''));
    return parts.join('').trim();
  }
  const value = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
  if (type === 's') {
    const index = parseInt(value, 10);
    return Number.isFinite(index) ? (shared[index] ?? '') : '';
  }
  if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  return decodeXmlEntities(value).trim();
}

// -------------------------------------------------------------------- PDF

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof document !== 'undefined') {
    // The worker is copied to public/ by scripts/copy-pdf-worker.mjs so the
    // app keeps working offline and under a GitHub Pages basePath.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).toString();
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = '';
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
      page.cleanup();
    }
    return pages.join('\n\n');
  } finally {
    await loadingTask.destroy();
  }
}

// ------------------------------------------------------------------ Entry

export async function extractQuestionsText(file: File): Promise<string> {
  const extension = extensionOf(file.name);
  let text: string;

  switch (extension) {
    case 'txt':
    case 'text':
    case 'md':
    case 'markdown':
      text = stripBom(await file.text());
      break;
    case 'csv':
    case 'tsv': {
      const raw = stripBom(await file.text());
      text = delimitedToMcqText(raw, file.name) || raw;
      break;
    }
    case 'rtf':
      text = rtfToText(await file.text());
      break;
    case 'docx':
      text = docxToText(await file.arrayBuffer());
      break;
    case 'odt':
      text = odtToText(await file.arrayBuffer());
      break;
    case 'xlsx': {
      const tsv = xlsxToDelimited(await file.arrayBuffer());
      text = delimitedToMcqText(tsv, 'sheet.tsv') || tsv;
      break;
    }
    case 'pdf':
      try {
        text = await pdfToText(file);
      } catch (error) {
        if (error instanceof FileImportError) throw error;
        throw new FileImportError(
          `Could not read "${file.name}". If it is password-protected or a scanned image, use the AI reformatting prompt below (or OCR it first).`,
        );
      }
      break;
    case 'doc':
    case 'xls':
      throw new FileImportError(
        `Legacy .${extension} files are not supported. Re-save the paper as .${
          extension === 'doc' ? 'docx' : 'xlsx'
        } (or PDF/CSV), or use the AI reformatting prompt below.`,
      );
    default:
      // Unknown extension: try plain text so unusual text exports still work.
      text = stripBom(await file.text());
  }

  const cleaned = tidy(text);
  if (!cleaned) {
    throw new FileImportError(
      `No readable text found in "${file.name}". If it is a scanned PDF, use the AI reformatting prompt below or OCR it first.`,
    );
  }
  return cleaned;
}
