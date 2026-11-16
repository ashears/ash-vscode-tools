import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(manifest.name, 'ash-vscode-tools');
assert.equal(manifest.contributes.languageModelTools.length, 3);
assert(!manifest.enabledApiProposals, 'Marketplace extensions must use stable APIs.');
for (const file of ['dist/extension.cjs', 'dist/pdf-worker.mjs', 'dist/webview.mjs', 'dist/webview.css', 'dist/pdfjs/pdf.mjs', 'dist/pdfjs/pdf.worker.mjs', 'dist/pdfjs/LICENSE', 'media/icon.png', 'THIRD_PARTY_NOTICES.txt']) {
  assert((await readFile(file)).length, `Missing packaged asset: ${file}`);
}
assert(!(await readdir('dist')).includes('node_modules'));
console.log('Manifest and packaged runtime assets verified.');
