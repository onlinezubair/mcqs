// The legacy build ships without bundled TypeScript declarations; re-use the
// main package's types for the deep import used by lib/fileImport.ts.
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
