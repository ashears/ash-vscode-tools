import { build, context } from 'esbuild';
import { mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/pdfjs', { recursive: true });
const jobs = [
  { entryPoints: ['src/extension.ts'], outfile: 'dist/extension.cjs', platform: 'node', format: 'cjs', external: ['vscode'] },
  { entryPoints: ['src/modules/pdf/worker.ts'], outfile: 'dist/pdf-worker.mjs', platform: 'node', format: 'esm' },
  { entryPoints: ['src/modules/pdf/webview.ts'], outfile: 'dist/webview.mjs', platform: 'browser', format: 'esm' },
  { entryPoints: ['test/host/index.ts'], outfile: 'dist/test-host.cjs', platform: 'node', format: 'cjs', external: ['vscode'] },
];
const options = { bundle: true, target: 'es2022', sourcemap: process.argv.includes('--sourcemap') ? 'linked' : false, logLevel: 'info', legalComments: 'eof' };
const watch = process.argv.includes('--watch');
for (const job of jobs) {
  if (watch) { const session = await context({ ...options, ...job }); await session.watch(); }
  else await build({ ...options, ...job });
}
const base = 'node_modules/pdfjs-dist';
for (const file of await readdir(`${base}/legacy/build`)) {
  if (file.endsWith('.mjs') && !file.includes('.min.') && !file.includes('.sandbox.')) await cp(`${base}/legacy/build/${file}`, `dist/pdfjs/${file}`);
}
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) await cp(`${base}/${dir}`, `dist/pdfjs/${dir}`, { recursive: true });
for (const file of ['pdf_viewer.mjs', 'pdf_viewer.css', 'images']) await cp(`${base}/legacy/web/${file}`, `dist/pdfjs/${file}`, { recursive: true });
await cp('src/modules/pdf/webview.css', 'dist/webview.css');
await cp(`${base}/LICENSE`, 'dist/pdfjs/LICENSE');
// Third-party asset directories contain additional notices, kept in the VSIX.
await writeFile('THIRD_PARTY_NOTICES.txt', `Ash VS Code Tools includes Mozilla PDF.js.\nPDF.js and its viewer are Copyright Mozilla Foundation and contributors.\nLicensed under Apache License 2.0 (full text below).\nFonts, CMaps, and WASM assets retain notices in dist/pdfjs/.\nThe upstream files are copied unchanged; Ash Tools wraps the viewer.\n\n${await readFile(join(base, 'LICENSE'), 'utf8')}`);
