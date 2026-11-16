import { afterAll, describe, expect, it, vi } from 'vitest';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtemp, copyFile, mkdir, rm, symlink, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PdfAccess, localPdfPath, readSnapshot, within } from '../../src/modules/pdf/access';
import { PdfService, type Cancellation } from '../../src/modules/pdf/service';
import { LIMITS, validateRequest } from '../../src/modules/pdf/protocol';
import { viewerHtml } from '../../src/modules/pdf/webview-html';

const root = resolve('test/fixtures');
const uri = (name: string) => pathToFileURL(join(root, `${name}.pdf`)).href;
const service = new PdfService(resolve('dist'), new PdfAccess(() => [root], () => true));
afterAll(() => service.dispose());

describe('real PDF extraction in background workers', () => {
  it('returns page count, metadata and outline with physical destinations', async () => {
    const result = await service.run(uri('reference'), { action: 'info' });
    expect(result.pageCount).toBe(2); expect(result.metadata?.Title).toBe('Ash Tools Technical Reference');
    expect(result.outline?.map(item => item.page)).toEqual([1, 2]);
  });
  it('preserves 1-based physical page boundaries and meaningful text', async () => {
    const result = await service.run(uri('reference'), { action: 'read', startPage: 1, endPage: 2 }, undefined, true);
    expect(result.pages?.[0]?.text).toContain('250 milliseconds');
    expect(result.pages?.[1]?.text).toContain('30 second deadline'); expect(result.pages?.map(page => page.page)).toEqual([1, 2]);
    expect(result.truncated).toBe(false);
  });
  it('extracts both columns without claiming layout reconstruction', async () => {
    const result = await service.run(uri('columns'), { action: 'read', startPage: 1, endPage: 1 });
    expect(result.pages?.[0]?.text).toContain('LEFT column'); expect(result.pages?.[0]?.text).toContain('RIGHT column');
  });
  it('reports scans explicitly and distinguishes zero search matches', async () => {
    const scan = await service.run(uri('scanned'), { action: 'read', startPage: 1, endPage: 1 });
    expect(scan.status).toBe('empty-text');
    expect((await service.run(uri('scanned'), { action: 'search', query: 'nothing' })).status).toBe('empty-text');
    const result = await service.run(uri('reference'), { action: 'search', query: 'absent query' });
    expect(result.status).toBe('ok'); expect(result.matches).toEqual([]);
  });
  it('searches literally, ignoring case, with correct citations and bounded output', async () => {
    const match = await service.run(uri('reference'), { action: 'search', query: 'INITIAL DELAY' });
    expect(match.matches?.[0]?.page).toBe(1); expect(match.matches?.[0]?.snippet).toContain('250 milliseconds');
    const literal = await service.run(uri('reference'), { action: 'search', query: '.*' }); expect(literal.matches).toEqual([]);
    const many = await service.run(uri('large'), { action: 'search', query: 'needle' });
    expect(many.matches).toHaveLength(LIMITS.matches); expect(many.truncated).toBe(true);
  });
  it('reports text truncation and rejects invalid/out-of-bounds ranges', async () => {
    const dense = await service.run(uri('dense'), { action: 'read', startPage: 1, endPage: 1 });
    expect(dense.truncated).toBe(true); expect(dense.pages?.[0]?.text.length).toBeLessThanOrEqual(LIMITS.textChars);
    await expect(service.run(uri('reference'), { action: 'read', startPage: 2, endPage: 3 })).rejects.toThrow('out of bounds');
    expect(() => validateRequest({ action: 'read', startPage: 0, endPage: 1 })).toThrow();
    expect(() => validateRequest({ action: 'read', startPage: 1, endPage: 21 })).toThrow();
    expect(() => validateRequest({ action: 'search', query: ' ' })).toThrow();
    expect(() => validateRequest({ action: 'read', startPage: 1.5, endPage: 2 })).toThrow();
  });
  it('rejects malformed and protected PDFs with actionable errors', async () => {
    await expect(service.run(uri('malformed'), { action: 'info' })).rejects.toThrow();
    await expect(service.run(uri('protected'), { action: 'info' })).rejects.toThrow('Password-protected');
  });
  it('supports cancellation before dispatch and while parsing, then recovers', async () => {
    const callbacks = new Set<() => void>();
    const token = { isCancellationRequested: false, onCancellationRequested: (callback: () => void) => { callbacks.add(callback); return { dispose: () => callbacks.delete(callback) }; } };
    const pending = service.run(uri('large'), { action: 'read', startPage: 40, endPage: 59 }, token);
    const timer = setInterval(() => { if (callbacks.size) { token.isCancellationRequested = true; callbacks.forEach(callback => callback()); } }, 10);
    try { await expect(pending).rejects.toThrow('cancelled'); } finally { clearInterval(timer); }
    await expect(service.run(uri('reference'), { action: 'info' }, token as Cancellation)).rejects.toThrow('cancelled');
    expect((await service.run(uri('reference'), { action: 'info' })).pageCount).toBe(2);
  });
});

describe('filesystem boundaries and cache invalidation', () => {
  it('allows workspace and explicitly opened files; denies outside and symlink escapes', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ash-access-'));
    try {
      const workspace = join(temp, 'workspace'), outside = join(temp, 'outside.pdf');
      await mkdir(workspace); await copyFile(join(root, 'reference.pdf'), outside);
      const access = new PdfAccess(() => [workspace], () => true);
      await expect(access.resolve(pathToFileURL(outside).href, true)).rejects.toThrow('denied');
      await symlink(outside, join(workspace, 'escape.pdf'));
      await expect(access.resolve(pathToFileURL(join(workspace, 'escape.pdf')).href, true)).rejects.toThrow('denied');
      await access.grantOpened(pathToFileURL(outside).href);
      await expect(access.resolve(pathToFileURL(outside).href, true)).resolves.toBe(await realpath(outside));
      const untrusted = new PdfAccess(() => [root], () => false);
      await untrusted.grantOpened(uri('reference'));
      await expect(untrusted.resolve(uri('reference'), true)).rejects.toThrow('trusted');
      await expect(untrusted.resolve(uri('reference'), false)).resolves.toBeTruthy();
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
  it('rejects network URLs, ambiguous file URIs and non-PDF paths', () => {
    for (const value of ['https://example.com/file.pdf', 'file://server/share/file.pdf', 'file:///tmp/a.pdf#1', 'file:///tmp/a.pdf?q=1', '/tmp/a.pdf', 'file:///tmp/a.txt']) expect(() => localPdfPath(value)).toThrow();
    expect(within('/project', '/project-other/test.pdf')).toBe(false);
  });
  it('never serves cached content after a file changes or trust is revoked', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ash-cache-'));
    let trusted = true;
    const local = new PdfService(resolve('dist'), new PdfAccess(() => [temp], () => trusted));
    try {
      const path = join(temp, 'changing.pdf'), file = pathToFileURL(path).href;
      await copyFile(join(root, 'reference.pdf'), path);
      expect((await local.run(file, { action: 'info' }, undefined, true)).pageCount).toBe(2);
      await copyFile(join(root, 'large.pdf'), path);
      expect((await local.run(file, { action: 'info' }, undefined, true)).pageCount).toBe(80);
      trusted = false;
      await expect(local.run(file, { action: 'info' }, undefined, true)).rejects.toThrow('trusted');
      await writeFile(path, 'broken');
      await expect(local.run(file, { action: 'info' })).rejects.toThrow();
      local.invalidate();
    } finally { local.dispose(); await rm(temp, { recursive: true, force: true }); }
  });
  it('rejects oversized files before allocation', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ash-size-'));
    try {
      const path = join(temp, 'large.pdf');
      const { open } = await import('node:fs/promises'); const handle = await open(path, 'w');
      await handle.truncate(LIMITS.fileBytes + 1); await handle.close();
      await expect(readSnapshot(path)).rejects.toThrow('64 MiB');
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
});

describe('webview security boundary', () => {
  it('allows only packaged scripts/resources and escapes interpolated attributes', () => {
    const html = viewerHtml({ script: 'local:script" onload="evil', css: 'local:style', pdfCss: 'local:pdf', cspSource: 'local:', nonce: 'random' });
    expect(html).toContain("default-src &#39;none&#39;");
    expect(html).toContain("object-src &#39;none&#39;"); expect(html).not.toContain("'unsafe-eval'");
    expect(html).toContain('nonce="random"'); expect(html).toContain('script&quot; onload=&quot;evil');
    expect(html).not.toContain('src="https:');
  });
});

vi.mock('vscode', () => ({}));
describe('tool input validation', async () => {
  const { toolInput } = await import('../../src/modules/pdf/tools');
  it('validates URI, operation inputs and extra properties at runtime', () => {
    expect(toolInput('info', { uri: uri('reference') }).request).toEqual({ action: 'info' });
    for (const input of [null, {}, { uri: 'https://example.com/a.pdf' }, { uri: uri('reference'), secret: 'extra' }]) expect(() => toolInput('info', input)).toThrow();
    expect(() => toolInput('read', { uri: uri('reference'), startPage: 2, endPage: 1 })).toThrow();
  });
});
