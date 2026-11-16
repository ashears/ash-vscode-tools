import { realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LIMITS } from './protocol';

export function localPdfPath(uri: string): string {
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw new Error('Supply an absolute file URI for a local PDF.'); }
  if (parsed.protocol !== 'file:' || parsed.host || parsed.search || parsed.hash) {
    throw new Error('Only local file URIs without a host, query, or fragment are supported.');
  }
  const path = fileURLToPath(parsed);
  if (extname(path).toLowerCase() !== '.pdf') throw new Error('Select a .pdf file.');
  return path;
}

export function within(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

/** Session grants are made only by the custom editor, never by tool input. */
export class PdfAccess {
  private readonly opened = new Set<string>();
  constructor(private readonly roots: () => string[], private readonly trusted: () => boolean) {}

  async grantOpened(uri: string): Promise<void> {
    this.opened.add(await realpath(localPdfPath(uri)));
  }

  async resolve(uri: string, forTool: boolean): Promise<string> {
    const path = await realpath(localPdfPath(uri));
    if (forTool) {
      if (!this.trusted()) throw new Error('PDF tools require a trusted workspace.');
      const roots = await Promise.all(this.roots().map(root => realpath(root).catch(() => '')));
      if (!this.opened.has(path) && !roots.some(root => root && within(root, path))) {
        throw new Error('PDF access denied. Use a workspace PDF or explicitly open this PDF in the Ash Tools reader first.');
      }
    }
    return path;
  }

  dispose(): void { this.opened.clear(); }
}

export interface PdfSnapshot { bytes: Uint8Array; signature: string; uri: string }

export async function readSnapshot(path: string): Promise<PdfSnapshot> {
  // Reject a final-component symlink introduced after authorization. Validate the
  // canonical path again after reading, before returning any bytes to the caller.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > LIMITS.fileBytes) throw new Error('PDF must be a regular file no larger than 64 MiB.');
    const bytes = new Uint8Array(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!read.bytesRead) break;
      offset += read.bytesRead;
    }
    const after = await handle.stat();
    if (offset !== before.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.size !== after.size || await realpath(path) !== path) {
      throw new Error('PDF changed while being read. Try again.');
    }
    return { bytes, signature: `${after.dev}:${after.ino}:${after.size}:${after.mtimeMs}:${after.ctimeMs}`, uri: pathToFileURL(path).href };
  } finally { await handle.close(); }
}
