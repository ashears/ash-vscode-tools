export const LIMITS = {
  fileBytes: 64 * 1024 * 1024,
  pages: 2000,
  readPages: 20,
  textChars: 48000,
  pageChars: 240000,
  matches: 40,
  cacheBytes: 8 * 1024 * 1024,
  timeoutMs: 30000,
} as const;

export type PdfRequest =
  | { action: 'info' }
  | { action: 'read'; startPage: number; endPage: number }
  | { action: 'search'; query: string };

export interface PdfPageText { page: number; text: string; truncated: boolean }
export interface PdfMatch { page: number; snippet: string }
export interface PdfOutline { title: string; page: number | null; children: PdfOutline[] }
export interface PdfResult {
  status: 'ok' | 'empty-text';
  pageCount: number;
  truncated: boolean;
  metadata?: Record<string, string>;
  outline?: PdfOutline[];
  pages?: PdfPageText[];
  matches?: PdfMatch[];
}

export interface WorkerRequest { bytes: Uint8Array; request: PdfRequest; assetRoot: string }
export type WorkerResponse = { ok: true; result: PdfResult } | { ok: false; error: string };

export function validateRequest(value: unknown): PdfRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid PDF operation.');
  const v = value as Record<string, unknown>;
  if (v.action === 'info') return { action: 'info' };
  if (v.action === 'search' && typeof v.query === 'string' && v.query.trim() && v.query.length <= 200) {
    return { action: 'search', query: v.query };
  }
  if (v.action === 'read' && Number.isSafeInteger(v.startPage) && Number.isSafeInteger(v.endPage)) {
    const startPage = v.startPage as number, endPage = v.endPage as number;
    if (startPage >= 1 && endPage >= startPage && endPage - startPage < LIMITS.readPages) {
      return { action: 'read', startPage, endPage };
    }
  }
  throw new Error('Use a non-empty query (up to 200 characters) or an inclusive range of 1–20 positive pages.');
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'PasswordException') {
    return 'Password-protected PDFs are not supported. Open an unprotected copy instead.';
  }
  return error instanceof Error ? error.message : 'Unable to process this PDF.';
}
