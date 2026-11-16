import { parentPort, workerData } from 'node:worker_threads';
import { extract } from './extract';
import { errorMessage, validateRequest, type WorkerRequest, type WorkerResponse } from './protocol';
import type * as PdfJs from 'pdfjs-dist';

const { bytes, request, assetRoot } = workerData as WorkerRequest;
let response: WorkerResponse;
try {
  // Keep PDF.js as a separate ESM asset; never evaluate it in the extension host.
  const pdf = await import(new URL('./pdfjs/pdf.mjs', import.meta.url).href) as typeof PdfJs;
  pdf.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.mjs', import.meta.url).href;
  // NodeBinaryDataFactory uses fs.readFile, so its asset base must be a
  // filesystem path (the webview's DOM factory uses URLs instead).
  const base = `${assetRoot}/`;
  const task = pdf.getDocument({ data: bytes, useSystemFonts: false, useWorkerFetch: false,
    cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`,
    disableFontFace: true, isOffscreenCanvasSupported: false, isImageDecoderSupported: false, verbosity: 0 });
  try {
    const document = await task.promise;
    response = { ok: true, result: await extract(document, validateRequest(request)) };
  } finally { await task.destroy(); }
} catch (error) { response = { ok: false, error: errorMessage(error) }; }
parentPort?.postMessage(response);
