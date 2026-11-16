export interface WebviewAssets { script: string; css: string; pdfCss: string; cspSource: string; nonce: string }
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function viewerHtml(assets: WebviewAssets): string {
  const { nonce, cspSource } = assets;
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' ${cspSource} 'wasm-unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: blob:; font-src ${cspSource} data:; connect-src ${cspSource}; worker-src ${cspSource} blob:; object-src 'none'; base-uri 'none'; form-action 'none';`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}"><title>Ash Tools PDF Reader</title><link rel="stylesheet" href="${escapeHtml(assets.pdfCss)}"><link rel="stylesheet" href="${escapeHtml(assets.css)}"></head><body>
  <header>
    <div class="brand"><span class="mark" aria-hidden="true">A</span><div><strong>Ash Tools</strong><span id="filename">PDF Reader</span></div><span class="local-badge">LOCAL PDF</span></div>
    <nav aria-label="PDF controls">
      <button id="sidebarToggle" title="Toggle document sidebar" aria-label="Toggle document sidebar">☰</button><span class="divider"></span>
      <button id="previous" title="Previous page" aria-label="Previous page">‹</button><label class="page-label">Page <input id="page" type="number" min="1" value="1" aria-label="Page number"></label><span id="pageCount">/ —</span><button id="next" title="Next page" aria-label="Next page">›</button>
      <span class="divider"></span><button id="zoomOut" aria-label="Zoom out">−</button><select id="zoom" aria-label="Zoom"><option value="page-width">Fit width</option><option value="page-fit">Fit page</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option><option value="custom" hidden>Custom</option></select><button id="zoomIn" aria-label="Zoom in">+</button><button id="rotate" title="Rotate clockwise" aria-label="Rotate clockwise">↻</button>
      <div class="search"><input id="query" type="search" placeholder="Find in document…" aria-label="Find in document"><button id="findPrevious" aria-label="Previous match">↑</button><button id="findNext" aria-label="Next match">↓</button><span id="findCount" aria-live="polite"></span></div>
    </nav>
    <div class="context-actions"><span class="context-label">USE WHILE CODING</span><button id="copyPage">Copy page + citation</button><button id="copySelection">Copy selection + citation</button><button id="previewText">Preview text</button><button id="exportMarkdown">Export Markdown…</button></div>
  </header>
  <main><aside id="sidebar"><div role="tablist" aria-label="Document navigation"><button id="outlineTab" role="tab" aria-selected="true">Outline</button><button id="thumbnailsTab" role="tab" aria-selected="false">Pages</button></div><div id="outline" role="tabpanel" aria-label="Document outline"></div><div id="thumbnails" role="tabpanel" aria-label="Page thumbnails" hidden></div><div class="sidebar-note">Rendered on your machine.<br>Copilot receives text only when you use its tools.</div></aside><div id="viewerContainer" tabindex="0" aria-label="PDF document"><div id="viewer" class="pdfViewer"></div></div><section id="loading" role="status"><span class="mark">A</span><h1>Your reference, right beside your code.</h1><p id="loadingText">Loading local PDF…</p></section></main>
  <footer><span id="status" role="status">Local rendering · No telemetry</span><span>Text extraction · Page citations · Copilot tools</span></footer>
  <script nonce="${nonce}" type="module" src="${escapeHtml(assets.script)}"></script></body></html>`;
}
