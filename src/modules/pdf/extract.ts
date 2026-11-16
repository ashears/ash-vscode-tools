import type { PDFDocumentProxy } from 'pdfjs-dist';
import { LIMITS, type PdfOutline, type PdfPageText, type PdfRequest, type PdfResult } from './protocol';

async function pageText(doc: PDFDocumentProxy, page: number): Promise<PdfPageText> {
  const proxy = await doc.getPage(page);
  try {
    const content = await proxy.getTextContent();
    let text = '', truncated = false;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str + (item.hasEOL ? '\n' : ' ');
      if (text.length > LIMITS.pageChars) { text = text.slice(0, LIMITS.pageChars); truncated = true; break; }
    }
    return { page, text: text.trim(), truncated };
  } finally { proxy.cleanup(); }
}

export async function extract(doc: PDFDocumentProxy, request: PdfRequest): Promise<PdfResult> {
  if (doc.numPages > LIMITS.pages) throw new Error('PDFs over 2,000 pages are not supported in this release.');
  const result: PdfResult = { status: 'ok', pageCount: doc.numPages, truncated: false };
  if (request.action === 'info') {
    const { info } = await doc.getMetadata();
    result.metadata = {};
    for (const [key, value] of Object.entries(info as object)) {
      if (typeof value === 'string') result.metadata[key] = value.slice(0, 1000);
    }
    let count = 0;
    type Items = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>;
    const walk = async (items: Items, depth = 0): Promise<PdfOutline[]> => {
      const out: PdfOutline[] = [];
      for (const item of items) {
        if (++count > 200 || depth > 8) { result.truncated = true; break; }
        let page: number | null = null;
        try {
          const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0] !== undefined) {
            page = typeof dest[0] === 'number' ? dest[0] + 1 : await doc.getPageIndex(dest[0]) + 1;
          }
        } catch { /* Broken outline destinations must not hide document metadata. */ }
        out.push({ title: item.title.slice(0, 500), page, children: await walk(item.items, depth + 1) });
      }
      return out;
    };
    result.outline = await walk(await doc.getOutline() ?? []);
    return result;
  }
  if (request.action === 'read') {
    if (request.endPage > doc.numPages) throw new Error(`PDF has ${doc.numPages} pages. Requested range is out of bounds.`);
    result.pages = [];
    let remaining: number = LIMITS.textChars;
    for (let page = request.startPage; page <= request.endPage; page++) {
      const extracted = await pageText(doc, page);
      if (extracted.text.length > remaining) { extracted.text = extracted.text.slice(0, remaining); extracted.truncated = true; }
      remaining -= extracted.text.length;
      result.pages.push(extracted);
      result.truncated ||= extracted.truncated;
      if (remaining === 0 && page < request.endPage) { result.truncated = true; break; }
    }
    if (result.pages.every(page => !page.text)) result.status = 'empty-text';
    return result;
  }
  result.matches = [];
  const needle = request.query.toLowerCase();
  let hasText = false;
  for (let page = 1; page <= doc.numPages; page++) {
    const extracted = await pageText(doc, page);
    hasText ||= !!extracted.text;
    result.truncated ||= extracted.truncated;
    const lower = extracted.text.toLowerCase();
    let offset = 0;
    while ((offset = lower.indexOf(needle, offset)) !== -1) {
      if (result.matches.length === LIMITS.matches) { result.truncated = true; return result; }
      result.matches.push({ page, snippet: extracted.text.slice(Math.max(0, offset - 100), offset + needle.length + 100) });
      offset += needle.length;
    }
  }
  if (!hasText) result.status = 'empty-text';
  return result;
}
