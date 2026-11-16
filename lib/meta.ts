export function todayLocalISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(input: string): string | null {
  const date = toDate(input);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Parses both "YYYY-MM-DD" (local, no UTC shift) and full date-time strings.
function toDate(value: string): Date | null {
  if (!value) return null;
  const isoMatch = ISO_DATE_ONLY.exec(value.trim());
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateForHeader(value: string): string {
  const date = toDate(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateForFilename(value: string): string {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

interface MetaLabelSource {
  program: string;
  semester: string;
  subject: string;
  subjectCode: string;
  examName: string;
  quizNumber: number;
  date: string;
}

export function buildMetaLabelParts(meta: MetaLabelSource): string[] {
  const parts: string[] = [];
  if (meta.program) parts.push(meta.program);
  if (meta.semester) parts.push('Semester ' + meta.semester);
  if (meta.subject) {
    parts.push(meta.subjectCode ? `${meta.subjectCode} — ${meta.subject}` : meta.subject);
  }
  if (meta.examName === 'Quiz') {
    parts.push(meta.quizNumber ? `Quiz ${meta.quizNumber}` : 'Quiz');
  } else if (meta.examName) {
    parts.push(meta.examName);
  }
  return parts;
}

export function buildMetaHeaderLine(meta: MetaLabelSource): string {
  const parts = buildMetaLabelParts(meta);
  const dateStr = formatDateForHeader(meta.date);
  if (dateStr) parts.push(dateStr);
  return parts.join(' — ');
}

export function buildMetaFileBase(meta: MetaLabelSource): string {
  const parts: string[] = [];
  if (meta.program) parts.push(meta.program.replace(/[^A-Za-z0-9]+/g, ''));
  if (meta.semester) parts.push('Sem' + meta.semester.replace(/[^A-Za-z0-9]+/g, ''));
  if (meta.subjectCode) {
    parts.push(meta.subjectCode.replace(/[^A-Za-z0-9]+/g, ''));
  } else if (meta.subject) {
    parts.push(meta.subject.replace(/\s+/g, ''));
  }
  if (meta.examName === 'Quiz') {
    parts.push('Quiz' + (meta.quizNumber || ''));
  } else if (meta.examName) {
    parts.push(meta.examName.replace(/\s+/g, ''));
  }
  const dateFrag = formatDateForFilename(meta.date);
  if (dateFrag) parts.push(dateFrag);

  if (parts.length === 0) return 'mcq-exam-' + todayLocalISO();
  return parts.join('_');
}
