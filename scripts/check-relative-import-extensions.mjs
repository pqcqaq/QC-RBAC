import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const scanRoots = ['apps', 'packages'];
const sourceFilePattern = /\.(?:ts|tsx|vue)$/i;
const disallowedExtensionPattern = /\.(?:[cm]?js|[cm]?ts|tsx)$/i;
const findings = [];

const collectMatches = (filePath, content, pattern) => {
  for (const match of content.matchAll(pattern)) {
    const specifier = match[2];
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      continue;
    }

    const pathname = specifier.split(/[?#]/, 1)[0];
    if (!disallowedExtensionPattern.test(pathname)) {
      continue;
    }

    const before = content.slice(0, match.index ?? 0);
    const line = before.split(/\r?\n/).length;
    findings.push(`${path.relative(root, filePath)}:${line} -> ${specifier}`);
  }
};

const scanFile = async (filePath) => {
  if (!sourceFilePattern.test(filePath)) {
    return;
  }

  const content = await fs.readFile(filePath, 'utf8');
  collectMatches(filePath, content, /(\bfrom\s*['"])([^'"]+)(['"])/g);
  collectMatches(filePath, content, /(\bimport\s*['"])([^'"]+)(['"])/g);
  collectMatches(filePath, content, /(\bimport\s*\(\s*['"])([^'"]+)(['"]\s*\))/g);
};

const walk = async (entryPath) => {
  const stat = await fs.stat(entryPath);
  if (stat.isFile()) {
    await scanFile(entryPath);
    return;
  }

  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    await walk(path.join(entryPath, entry.name));
  }
};

for (const scanRoot of scanRoots) {
  const absoluteRoot = path.resolve(root, scanRoot);
  await walk(absoluteRoot);
}

if (findings.length > 0) {
  console.error('Relative source imports must not include TypeScript or JavaScript file extensions:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log('Relative source import specifiers are clean.');
