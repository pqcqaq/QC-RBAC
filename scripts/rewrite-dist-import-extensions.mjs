import fs from 'node:fs/promises';
import path from 'node:path';

const targetDirs = process.argv.slice(2);

if (targetDirs.length === 0) {
  console.error('[rewrite-dist-import-extensions] expected at least one directory');
  process.exit(1);
}

const codeFilePattern = /\.(?:[cm]?js|d\.(?:ts|mts|cts))$/i;
const knownExtensionPattern = /\.(?:[cm]?js|json|node|wasm)$/i;

const rewriteSpecifier = (specifier) => {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }

  const [pathname, suffix = ''] = specifier.split(/([?#].*)/, 2);
  if (knownExtensionPattern.test(pathname)) {
    return specifier;
  }

  return `${pathname}.js${suffix}`;
};

const rewriteContent = (content) =>
  content
    .replace(/(\bfrom\s*['"])(\.{1,2}\/[^"'\\\r\n]+)(['"])/g, (_match, prefix, specifier, suffix) =>
      `${prefix}${rewriteSpecifier(specifier)}${suffix}`)
    .replace(/(\bimport\s*['"])(\.{1,2}\/[^"'\\\r\n]+)(['"])/g, (_match, prefix, specifier, suffix) =>
      `${prefix}${rewriteSpecifier(specifier)}${suffix}`)
    .replace(/(\bimport\s*\(\s*['"])(\.{1,2}\/[^"'\\\r\n]+)(['"]\s*\))/g, (_match, prefix, specifier, suffix) =>
      `${prefix}${rewriteSpecifier(specifier)}${suffix}`);

const rewriteFile = async (filePath) => {
  const original = await fs.readFile(filePath, 'utf8');
  const rewritten = rewriteContent(original);

  if (rewritten !== original) {
    await fs.writeFile(filePath, rewritten, 'utf8');
  }
};

const walk = async (entryPath) => {
  const stat = await fs.stat(entryPath);
  if (stat.isFile()) {
    if (codeFilePattern.test(entryPath)) {
      await rewriteFile(entryPath);
    }
    return;
  }

  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  for (const entry of entries) {
    await walk(path.join(entryPath, entry.name));
  }
};

for (const targetDir of targetDirs) {
  await walk(path.resolve(process.cwd(), targetDir));
}
