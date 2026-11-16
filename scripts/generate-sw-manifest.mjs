import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const outDir = path.join(process.cwd(), 'out');
const swPath = path.join(outDir, 'sw.js');
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

if (!fs.existsSync(outDir)) {
  console.error('out/ directory not found. Run `npm run build` first.');
  process.exit(1);
}

function getAllFiles(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(prefix, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

const allFiles = getAllFiles(outDir);
const precacheFiles = allFiles
  .filter(f => !f.endsWith('.map') && f !== 'sw.js' && f !== 'manifest.webmanifest')
  .map(f => `${basePath}/${f}`);

const manifestContent = `self.__PRECACHE_MANIFEST__ = ${JSON.stringify(precacheFiles, null, 2)};`;
const basePathContent = `self.__BASE_PATH__ = ${JSON.stringify(basePath)};`;

// Version the cache by the build's own file hashes. Without this the browser
// kept serving the previous build's cached chunks forever (fixed CACHE_NAME),
// so shipped fixes — like the seed inside the ZIP — never reached the user.
const hash = createHash('sha256');
for (const file of [...precacheFiles].sort()) {
  try {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(outDir, file)));
  } catch {
    // A file listed but unreadable should not abort the build.
  }
}
const cacheVersion = `mcq-projector-${hash.digest('hex').slice(0, 12)}`;
const cacheVersionContent = `self.__CACHE_VERSION__ = ${JSON.stringify(cacheVersion)};`;

let swContent = fs.readFileSync(swPath, 'utf-8');
swContent = swContent.replace(
  /const PRECACHE_MANIFEST = self\.__PRECACHE_MANIFEST__ \|\| \[\];/,
  `${manifestContent}\n${basePathContent}\n${cacheVersionContent}\nconst PRECACHE_MANIFEST = self.__PRECACHE_MANIFEST__ || [];`
);

fs.writeFileSync(swPath, swContent);
console.log(`Updated sw.js with ${precacheFiles.length} precache entries (basePath: "${basePath || '/'}", cache: ${cacheVersion})`);
