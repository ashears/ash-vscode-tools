import type * as PdfJs from 'pdfjs-dist';
import type * as Viewer from 'pdfjs-dist/web/pdf_viewer.mjs';

interface ViewState { page: number; zoom: string | number; rotation: number }
interface HostApi { postMessage(message: unknown): void; getState(): ViewState | undefined; setState(state: ViewState): void }
declare function acquireVsCodeApi(): HostApi;
const host = acquireVsCodeApi();
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string, click: () => void) => element(id).addEventListener('click', click);
const status = (text: string) => { element('status').textContent = text; };
const pdf = await import(new URL('./pdfjs/pdf.mjs', import.meta.url).href) as typeof PdfJs;
Object.assign(globalThis, { pdfjsLib: pdf });
const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = await import(new URL('./pdfjs/pdf_viewer.mjs', import.meta.url).href) as typeof Viewer;
pdf.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.mjs', import.meta.url).href;
const bus = new EventBus();
const links = new PDFLinkService({ eventBus: bus });
const finder = new PDFFindController({ eventBus: bus, linkService: links });
const viewer = new PDFViewer({ container: element<HTMLDivElement>('viewerContainer'), viewer: element<HTMLDivElement>('viewer'),
  eventBus: bus, linkService: links, findController: finder, annotationMode: pdf.AnnotationMode.ENABLE,
  annotationEditorMode: pdf.AnnotationEditorType.NONE, enableAutoLinking: false, maxCanvasPixels: 16 * 1024 * 1024,
  imageResourcesPath: new URL('./pdfjs/images/', import.meta.url).href });
links.setViewer(viewer);
let task: PdfJs.PDFDocumentLoadingTask | undefined;
let documentProxy: PdfJs.PDFDocumentProxy | undefined;
let generation = 0, restored: ViewState = host.getState() ?? { page: 1, zoom: 'page-width', rotation: 0 };
let loading = false;
const persist = () => {
  if (!documentProxy || loading) return;
  restored = { page: viewer.currentPageNumber, zoom: viewer.currentScaleValue, rotation: viewer.pagesRotation };
  host.setState(restored); host.postMessage({ type: 'viewState', ...restored });
};
bus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => { element<HTMLInputElement>('page').value = String(pageNumber); persist(); });
bus.on('scalechanging', ({ scale }: { scale: number }) => {
  const input = element<HTMLSelectElement>('zoom');
  input.value = ['page-width', 'page-fit'].includes(viewer.currentScaleValue) ? viewer.currentScaleValue : 'custom';
  const custom = input.querySelector<HTMLOptionElement>('[value=custom]')!;
  custom.textContent = `${Math.round(scale * 100)}%`; persist();
});
bus.on('pagesinit', () => {
  const target = { ...restored };
  viewer.currentScaleValue = String(target.zoom);
  viewer.pagesRotation = target.rotation;
  element('loading').hidden = true;
  requestAnimationFrame(() => {
    viewer.currentPageNumber = Math.min(Math.max(restored.page, 1), viewer.pagesCount);
    loading = false; persist();
  });
});
bus.on('pagerendered', ({ error }: { error?: unknown }) => { if (error) status('This page could not render. Try Preview text or another PDF reader.'); });
bus.on('updatefindmatchescount', ({ matchesCount }: { matchesCount: { current: number; total: number } }) => {
  element('findCount').textContent = `${matchesCount.current}/${matchesCount.total}`;
});
bus.on('updatefindcontrolstate', ({ state }: { state: number }) => { if (state === 1) element('findCount').textContent = '0/0'; });

async function load(bytes: ArrayBuffer | number[], filename: string, initial?: ViewState): Promise<void> {
  const current = ++generation;
  loading = true; restored = initial ?? restored;
  element('filename').textContent = filename;
  element('loading').hidden = false; element('loadingText').textContent = 'Loading local PDF…';
  try {
    thumbnailObserver?.disconnect();
    if (task) { viewer.setDocument(null!); links.setDocument(null!); await task.destroy(); }
    if (current !== generation) return;
    documentProxy = undefined;
    const base = new URL('./pdfjs/', import.meta.url).href;
    // PDF.js 6 removed JavaScript evaluation from the parser; do not attach a scripting manager.
    task = pdf.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false,
      cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, verbosity: 0 });
    const doc = await task.promise;
    if (current !== generation) return;
    if (doc.numPages > 2000) throw new Error('PDFs over 2,000 pages are not supported in this release.');
    documentProxy = doc;
    element('pageCount').textContent = `/ ${doc.numPages}`;
    element<HTMLInputElement>('page').max = String(doc.numPages);
    links.setDocument(doc); viewer.setDocument(doc);
    void outline(doc, current);
    thumbnails(doc, current);
    status('Local rendering · Use page citations to verify Copilot answers');
    const first = await doc.getPage(1);
    const text = await first.getTextContent();
    if (current === generation && !text.items.some(item => 'str' in item && item.str.trim())) {
      status('No text found on page 1. Scanned pages need OCR, which is not included.');
    }
  } catch (error) {
    if (current !== generation) return;
    const message = error instanceof Error && error.name === 'PasswordException' ? 'Password-protected PDFs are not supported. Open an unprotected copy.' : error instanceof Error ? error.message : 'Could not open PDF.';
    element('loading').hidden = false; element('loadingText').textContent = message; status(message); loading = false;
  }
}

async function outline(doc: PdfJs.PDFDocumentProxy, current: number): Promise<void> {
  const root = element('outline'); root.replaceChildren();
  try {
    const items = await doc.getOutline();
    if (current !== generation) return;
    if (!items?.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No document outline. Switch to Pages to browse.'; root.append(empty); return; }
    let count = 0;
    const append = (entries: typeof items, parent: HTMLElement, depth: number) => {
      if (depth > 8) return;
      for (const entry of entries) {
        if (++count > 200) return;
        const item = document.createElement('button'); item.textContent = entry.title; item.style.paddingLeft = `${8 + depth * 12}px`;
        item.addEventListener('click', () => { if (entry.dest) void links.goToDestination(entry.dest); }); parent.append(item);
        append(entry.items, parent, depth + 1);
      }
    };
    append(items, root, 0);
  } catch { root.textContent = 'The document outline could not be loaded.'; }
}

let thumbnailObserver: IntersectionObserver | undefined;
function thumbnails(doc: PdfJs.PDFDocumentProxy, current: number): void {
  const root = element('thumbnails'); root.replaceChildren();
  // Lazy, sequential previews avoid rendering thousands of canvases at once.
  let chain = Promise.resolve();
  thumbnailObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      thumbnailObserver?.unobserve(entry.target);
      chain = chain.then(async () => {
        if (generation !== current) return;
        const node = entry.target as HTMLElement;
        const page = await doc.getPage(Number(node.dataset.page));
        const viewport = page.getViewport({ scale: 130 / page.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        if (generation === current) node.prepend(canvas);
      }).catch(() => { /* A bad thumbnail must not prevent viewing other pages. */ });
    }
  }, { root: element('sidebar'), rootMargin: '150px' });
  for (let page = 1; page <= Math.min(doc.numPages, 200); page++) {
    const node = document.createElement('button'); node.dataset.page = String(page); node.setAttribute('aria-label', `Go to page ${page}`);
    const label = document.createElement('span'); label.textContent = `Page ${page}`; node.append(label);
    node.addEventListener('click', () => { viewer.currentPageNumber = page; });
    root.append(node); thumbnailObserver.observe(node);
  }
  if (doc.numPages > 200) {
    const note = document.createElement('p'); note.className = 'empty'; note.textContent = 'Thumbnails show the first 200 pages. Use the page number field for the rest.'; root.append(note);
  }
}

function find(previous = false, again = false): void {
  bus.dispatch('find', { source: window, type: again ? 'again' : '', query: element<HTMLInputElement>('query').value,
    caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
}
button('previous', () => { if (documentProxy && viewer.currentPageNumber > 1) viewer.currentPageNumber--; });
button('next', () => { if (documentProxy && viewer.currentPageNumber < viewer.pagesCount) viewer.currentPageNumber++; });
element<HTMLInputElement>('page').addEventListener('change', event => {
  if (!documentProxy) return;
  viewer.currentPageNumber = Math.min(viewer.pagesCount, Math.max(1, Number((event.target as HTMLInputElement).value) || 1));
});
function zoom(value: string | number): void {
  if (!documentProxy) return;
  const page = viewer.currentPageNumber;
  viewer.currentScaleValue = String(value);
  // PDF.js may still have a scroll location from the preceding page when a
  // user zooms immediately after navigation. Keep the explicitly selected page.
  viewer.currentPageNumber = page; persist();
}
element<HTMLSelectElement>('zoom').addEventListener('change', event => zoom((event.target as HTMLSelectElement).value));
button('zoomIn', () => zoom(Math.min(4, viewer.currentScale * 1.2)));
button('zoomOut', () => zoom(Math.max(0.25, viewer.currentScale / 1.2)));
button('rotate', () => { if (documentProxy) { const page = viewer.currentPageNumber; viewer.pagesRotation = (viewer.pagesRotation + 90) % 360; viewer.currentPageNumber = page; persist(); } });
button('sidebarToggle', () => { document.body.classList.toggle('no-sidebar'); window.dispatchEvent(new Event('resize')); });
function tab(thumbnails: boolean): void {
  element('outline').hidden = thumbnails; element('thumbnails').hidden = !thumbnails;
  element('outlineTab').setAttribute('aria-selected', String(!thumbnails)); element('thumbnailsTab').setAttribute('aria-selected', String(thumbnails));
}
button('outlineTab', () => tab(false)); button('thumbnailsTab', () => tab(true));
element('query').addEventListener('input', () => find());
element('query').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); find(event.shiftKey, true); } });
button('findPrevious', () => find(true, true)); button('findNext', () => find(false, true));
for (const id of ['copyPage', 'previewText', 'exportMarkdown']) button(id, () => { if (documentProxy) host.postMessage({ type: id, page: viewer.currentPageNumber }); });

let selected: { text: string; startPage: number; endPage: number } | undefined;
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const pageOf = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>('.page')?.dataset.pageNumber;
  const start = Number(pageOf(selection?.anchorNode ?? null)), end = Number(pageOf(selection?.focusNode ?? null));
  if (selection?.toString().trim() && start && end) selected = { text: selection.toString().slice(0, 48000), startPage: Math.min(start, end), endPage: Math.max(start, end) };
  else selected = undefined;
});
element('copySelection').addEventListener('mousedown', event => event.preventDefault());
button('copySelection', () => { if (selected) host.postMessage({ type: 'copySelection', ...selected }); else status('Select text on a PDF page first.'); });
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'load') void load(message.bytes, message.filename, message.state);
  if (message.type === 'error') { element('loading').hidden = false; element('loadingText').textContent = message.message; }
  if (message.type === 'goToPage' && Number.isInteger(message.page)) {
    restored = { ...restored, page: Math.min(2000, Math.max(1, message.page)) };
    if (documentProxy && !loading) viewer.currentPageNumber = Math.min(viewer.pagesCount, restored.page);
  }
  if (message.type === 'copySelection') element('copySelection').click();
  if (message.type === 'status') status(message.message);
});
document.addEventListener('click', event => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return;
  const url = anchor.getAttribute('href') ?? '';
  if (url.startsWith('#')) return;
  event.preventDefault(); event.stopPropagation();
  if (event.isTrusted && /^https?:/i.test(url)) host.postMessage({ type: 'externalLink', url });
}, true);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); element('query').focus(); return; }
  if ((event.target as HTMLElement).matches('input,select,textarea')) return;
  if (event.key === 'ArrowRight') element('next').click();
  if (event.key === 'ArrowLeft') element('previous').click();
  if (event.key === '+' || event.key === '=') element('zoomIn').click();
  if (event.key === '-') element('zoomOut').click();
});
host.postMessage({ type: 'ready' });
