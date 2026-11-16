// Copies the pdf.js worker into public/ so PDF import works offline and under
// a basePath (GitHub Pages). Runs automatically after npm install.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs');
const destinationDir = resolve(root, 'public');
const destination = resolve(destinationDir, 'pdf.worker.min.mjs');

if (existsSync(source)) {
  mkdirSync(destinationDir, { recursive: true });
  copyFileSync(source, destination);
  console.log('Copied pdf.worker.min.mjs to public/.');
} else {
  console.warn('pdfjs-dist worker not found — skipping PDF worker copy.');
}
