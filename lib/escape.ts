export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeFilename(name: string, maxLength = 200): string {
  const reserved = new Set(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']);
  let result = name
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+$/, '_')
    .trim();

  if (reserved.has(result.toUpperCase())) {
    result = '_' + result;
  }

  if (result.endsWith('.')) {
    result = result.slice(0, -1) + '_';
  }

  if (result.length > maxLength) {
    result = result.slice(0, maxLength).trim();
  }

  return result || 'untitled';
}

export function csvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  const needsQuotes = /[",\n\r]/.test(text);
  if (!needsQuotes) return text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function buildCsv(rows: string[][]): string {
  const BOM = '\uFEFF';
  return BOM + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
