import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Parse the ZIP central directory using Node only, so checks work on every OS.
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const name = `ash-vscode-tools-${manifest.version}.vsix`;
const bytes = await readFile(name), files = [];
for (let i = 0; i < bytes.length - 46; i++) {
  if (bytes.readUInt32LE(i) !== 0x02014b50) continue;
  const length = bytes.readUInt16LE(i + 28); files.push(bytes.subarray(i + 46, i + 46 + length).toString());
  i += 45 + length + bytes.readUInt16LE(i + 30) + bytes.readUInt16LE(i + 32);
}
assert(files.length > 10, 'Not a valid packaged extension');
for (const file of files) assert(!/(?:^|\/)(?:node_modules|src|test|scripts|\.github|\.git|\.env)(?:[/.]|$)/.test(file), `Development or secret file leaked: ${file}`);
assert(!files.includes('extension/dist/test-host.cjs'), 'Do not ship the test runner');
for (const required of ['extension/dist/extension.cjs', 'extension/dist/pdf-worker.mjs', 'extension/dist/webview.mjs', 'extension/THIRD_PARTY_NOTICES.txt', 'extension/media/icon.png']) assert(files.includes(required), `Missing runtime file: ${required}`);
console.log(`${name}: ${files.length} files, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB; contents verified.`);
