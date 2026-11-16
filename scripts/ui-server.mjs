// Test-only harness: serves the exact packaged viewer with a mocked VS Code bridge.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { viewerHtml } from '../src/modules/pdf/webview-html.ts';
const origin = 'http://127.0.0.1:4317';
const mime = { '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.pdf': 'application/pdf' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, origin).pathname;
    if (path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(viewerHtml({ script: '/dist/webview.mjs', css: '/dist/webview.css', pdfCss: '/dist/pdfjs/pdf_viewer.css', cspSource: origin, nonce: 'test-only-nonce' })); return;
    }
    if (!/^\/(dist|test\/fixtures)\//.test(path)) { res.writeHead(404); res.end(); return; }
    const file = resolve(`.${decodeURIComponent(path)}`);
    if (!file.startsWith(`${resolve('.')}/`)) throw new Error('Outside test root');
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
server.listen(4317, '127.0.0.1');
process.on('SIGTERM', () => server.close());
