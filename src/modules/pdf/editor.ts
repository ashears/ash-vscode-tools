import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { basename, dirname } from 'node:path';
import { localPdfPath, readSnapshot } from './access';
import { errorMessage } from './protocol';
import type { PdfService } from './service';
import { viewerHtml } from './webview-html';

export interface ViewState { page: number; zoom: string | number; rotation: number }
export interface PdfDocument extends vscode.CustomDocument { readonly uri: vscode.Uri }
export interface PdfView { document: PdfDocument; panel: vscode.WebviewPanel; state: ViewState; ready: boolean; pendingPage?: number }

export function validateState(value: unknown): ViewState | undefined {
  if (!value || typeof value !== 'object') return;
  const state = value as Record<string, unknown>;
  const zoom = state.zoom;
  if (!Number.isInteger(state.page) || Number(state.page) < 1 || Number(state.page) > 2000 ||
    ![0, 90, 180, 270].includes(Number(state.rotation)) ||
    !(zoom === 'page-width' || zoom === 'page-fit' || (typeof zoom === 'number' && zoom >= 0.1 && zoom <= 10) ||
      (typeof zoom === 'string' && /^\d+(\.\d+)?$/.test(zoom) && Number(zoom) >= 0.1 && Number(zoom) <= 10))) return;
  return { page: Number(state.page), zoom: zoom as string | number, rotation: Number(state.rotation) };
}

export class PdfEditor implements vscode.CustomReadonlyEditorProvider<PdfDocument>, vscode.Disposable {
  private views = new Set<PdfView>();
  private disposables: vscode.Disposable[] = [];
  private remembered: Record<string, ViewState>;
  constructor(private readonly context: vscode.ExtensionContext, private readonly service: PdfService,
    private readonly action: (type: string, view: PdfView, data?: Record<string, unknown>) => Promise<void>) {
    this.remembered = context.workspaceState.get('pdf.views', {});
  }
  get active(): PdfView | undefined { return [...this.views].find(view => view.panel.active); }

  async openCustomDocument(uri: vscode.Uri): Promise<PdfDocument> {
    localPdfPath(uri.toString());
    await this.service.access.grantOpened(uri.toString());
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(document: PdfDocument, panel: vscode.WebviewPanel): Promise<void> {
    const root = vscode.Uri.joinPath(this.context.extensionUri, 'dist');
    panel.webview.options = { enableScripts: true, localResourceRoots: [root], enableCommandUris: false };
    const asset = (path: string) => panel.webview.asWebviewUri(vscode.Uri.joinPath(root, path)).toString();
    const state = validateState(this.remembered[document.uri.toString()]) ?? { page: 1, zoom: 'page-width', rotation: 0 };
    const view: PdfView = { document, panel, state, ready: false };
    this.views.add(view);
    let disposed = false, sequence = 0;
    const load = async () => {
      const current = ++sequence;
      try {
        const path = await this.service.access.resolve(document.uri.toString(), false);
        const snapshot = await readSnapshot(path);
        if (!disposed && current === sequence) {
          await panel.webview.postMessage({ type: 'load', bytes: snapshot.bytes.buffer, filename: basename(path),
            state: view.pendingPage ? { ...view.state, page: view.pendingPage } : view.state });
          view.pendingPage = undefined;
        }
      } catch (error) {
        if (!disposed) await panel.webview.postMessage({ type: 'error', message: errorMessage(error) });
      }
    };
    let timer: NodeJS.Timeout | undefined;
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dirname(document.uri.fsPath), basename(document.uri.fsPath)));
    const refresh = () => {
      this.service.invalidate(); clearTimeout(timer);
      timer = setTimeout(() => { if (view.ready) void load(); }, 200);
    };
    const registrations = [watcher, watcher.onDidChange(refresh), watcher.onDidCreate(refresh), watcher.onDidDelete(refresh),
      panel.webview.onDidReceiveMessage(async (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const message = data as Record<string, unknown>;
        if (message.type === 'ready') { view.ready = true; await load(); return; }
        if (message.type === 'viewState') {
          const next = validateState(message);
          if (next) { view.state = next; }
          return;
        }
        if (typeof message.type === 'string' && ['copySelection', 'copyPage', 'previewText', 'exportMarkdown', 'externalLink'].includes(message.type)) {
          try { await this.action(message.type, view, message); }
          catch (error) { void vscode.window.showErrorMessage(`Ash Tools: ${errorMessage(error)}`); }
        }
      })];
    panel.onDidDispose(() => {
      disposed = true; clearTimeout(timer); this.views.delete(view);
      delete this.remembered[document.uri.toString()];
      this.remembered[document.uri.toString()] = view.state;
      this.remembered = Object.fromEntries(Object.entries(this.remembered).slice(-100));
      void this.context.workspaceState.update('pdf.views', this.remembered);
      registrations.forEach(item => item.dispose());
    });
    panel.webview.html = viewerHtml({ script: asset('webview.mjs'), css: asset('webview.css'), pdfCss: asset('pdfjs/pdf_viewer.css'),
      cspSource: panel.webview.cspSource, nonce: randomBytes(24).toString('base64') });
  }

  async openAtPage(uri: vscode.Uri, page: number): Promise<void> {
    await vscode.commands.executeCommand('vscode.openWith', uri, 'ashTools.pdfViewer');
    for (const view of this.views) {
      if (view.document.uri.toString() !== uri.toString()) continue;
      view.state = { ...view.state, page };
      // Loading must restore this page even if the webview has not initialized.
      view.pendingPage = page;
      await view.panel.webview.postMessage({ type: 'goToPage', page });
    }
  }
  dispose(): void {
    for (const view of this.views) view.panel.dispose();
    this.disposables.forEach(item => item.dispose()); this.disposables = [];
  }
}
