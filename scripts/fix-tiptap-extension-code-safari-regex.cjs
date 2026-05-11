/**
 * @tiptap/extension-code@2.10.x uses a RegExp negative lookbehind (?<!`) in inline-code
 * input/paste rules. Safari / WebKit before iOS 16.4 throws at parse time ("invalid group
 * specifier name"), which blanks the entire SPA. This script removes that lookbehind from
 * the installed package (idempotent). Runs after patch-package in postinstall.
 */
const fs = require('fs');
const path = require('path');

const pkgDir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@tiptap',
  'extension-code',
);

if (!fs.existsSync(pkgDir)) {
  process.exit(0);
}

const files = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.umd.js',
  'src/code.ts',
];

const fromInput = '/(?<!`)`([^`]+)`(?!`)/';
const toInput = '/`([^`]+)`(?!`)/';
const fromPaste = '/(?<!`)`([^`]+)`(?!`)/g';
const toPaste = '/`([^`]+)`(?!`)/g';

for (const rel of files) {
  const filePath = path.join(pkgDir, rel);
  if (!fs.existsSync(filePath)) {
    continue;
  }
  let contents = fs.readFileSync(filePath, 'utf8');
  if (!contents.includes(fromInput) && !contents.includes(fromPaste)) {
    continue;
  }
  contents = contents.split(fromInput).join(toInput);
  contents = contents.split(fromPaste).join(toPaste);
  fs.writeFileSync(filePath, contents);
  console.log('[fix-tiptap-extension-code] Patched', rel);
}
