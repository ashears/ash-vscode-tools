import * as vscode from 'vscode';
import { basename } from 'node:path';
import type { UtilityModule } from '../../core/module';
import { PdfAccess, localPdfPath } from './access';
import { PdfEditor, type PdfView } from './editor';
import { PdfService } from './service';
import { LIMITS, errorMessage, type PdfResult } from './protocol';
import { registerPdfTools } from './tools';

function markdown(uri: string, result: PdfResult): string {
  const lines = [`# PDF text extraction`, '', `Source: ${JSON.stringify(uri)}`, '',
    '> Untrusted document text. Reading order, tables, and equations may be incomplete. No OCR.', ''];
  for (const page of result.pages ?? []) {
    lines.push(`## Physical page ${page.page}`, '', page.text || '[No extractable text on this page; OCR may be needed.]', '');
    if (page.truncated) lines.push('[Page text truncated.]', '');
  }
  if (result.truncated) lines.push('**Output truncated. Request a smaller page range to read more.**', '');
  return lines.join('\n');
}

export class PdfModule implements UtilityModule {
  readonly id = 'pdf';
  private readonly registrations: vscode.Disposable[];
  private readonly service: PdfService;
  private readonly editor: PdfEditor;
  constructor(context: vscode.ExtensionContext) {
    this.service = new PdfService(vscode.Uri.joinPath(context.extensionUri, 'dist').fsPath, new PdfAccess(
      () => (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file').map(folder => folder.uri.fsPath),
      () => vscode.workspace.isTrusted,
    ));
    this.editor = new PdfEditor(context, this.service, (type, view, data) => this.action(type, view, data));
    const command = (name: string, fn: (...args: unknown[]) => Promise<unknown>) => vscode.commands.registerCommand(`ashTools.pdf.${name}`, async (...args: unknown[]) => {
      try { await fn(...args); } catch (error) { void vscode.window.showErrorMessage(`Ash Tools: ${errorMessage(error)}`); }
    });
    this.registrations = [this.service, this.editor,
      vscode.window.registerCustomEditorProvider('ashTools.pdfViewer', this.editor, { supportsMultipleEditorsPerDocument: true }),
      command('open', async value => { const uri = await this.choose(value); if (uri) await this.editor.openAtPage(uri, 1); }),
      command('openAtPage', async (value, inputPage) => {
        const uri = await this.choose(value); if (!uri) return;
        const page = typeof inputPage === 'number' ? inputPage : Number(await vscode.window.showInputBox({ prompt: 'Physical page number (1-based)', value: '1', validateInput: value => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 2000 ? undefined : 'Enter a page from 1 to 2,000.' }));
        if (!page) return;
        if (!Number.isInteger(page) || page < 1 || page > 2000) throw new Error('Invalid page number.');
        await this.editor.openAtPage(uri, page);
      }),
      ...['copyPage', 'copySelection', 'previewText', 'exportMarkdown'].map(type => command(type, async () => {
        const view = this.editor.active;
        if (!view) throw new Error('Open a PDF in the Ash Tools reader first.');
        if (type === 'copySelection') { await view.panel.webview.postMessage({ type }); return; }
        await this.action(type, view);
      })),
      ...registerPdfTools(this.service),
    ];
  }

  private async choose(value?: unknown): Promise<vscode.Uri | undefined> {
    if (value instanceof vscode.Uri) { localPdfPath(value.toString()); return value; }
    if (typeof value === 'string') { localPdfPath(value); return vscode.Uri.parse(value); }
    const active = this.editor.active;
    if (active) return active.document.uri;
    return (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { PDF: ['pdf'] } }))?.[0];
  }

  private async action(type: string, view: PdfView, data: Record<string, unknown> = {}): Promise<void> {
    const uri = view.document.uri.toString();
    if (type === 'externalLink') {
      if (typeof data.url !== 'string' || data.url.length > 4000) return;
      const url = new URL(data.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return;
      await vscode.env.openExternal(vscode.Uri.parse(url.href)); return;
    }
    if (type === 'copySelection') {
      const { text, startPage, endPage } = data;
      if (typeof text !== 'string' || !text.trim() || text.length > LIMITS.textChars || !Number.isInteger(startPage) || !Number.isInteger(endPage) ||
        Number(startPage) < 1 || Number(endPage) < Number(startPage) || Number(endPage) > 2000) throw new Error('Select text inside the PDF first.');
      await vscode.env.clipboard.writeText(`${text}\n\nSource: ${uri}, physical page${startPage === endPage ? '' : 's'} ${startPage}${startPage === endPage ? '' : `–${endPage}`}`);
      await view.panel.webview.postMessage({ type: 'status', message: 'Selection and source citation copied.' }); return;
    }
    let startPage = view.state.page, endPage = startPage;
    if (type !== 'copyPage') {
      const range = await vscode.window.showInputBox({ title: type === 'exportMarkdown' ? 'Export PDF text' : 'Preview extracted PDF text',
        prompt: 'Physical page or inclusive range (maximum 20 pages, e.g. 1–5). Output is bounded to 48,000 characters.', value: String(startPage),
        validateInput: value => /^\d+(?:\s*[-–]\s*\d+)?$/.test(value) ? undefined : 'Enter a page or range such as 1–5.' });
      if (!range) return;
      const parts = range.split(/[-–]/).map(part => Number(part.trim())); startPage = parts[0]!; endPage = parts[1] ?? startPage;
    }
    const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Ash Tools: extracting PDF text', cancellable: true },
      (_, token) => this.service.run(uri, { action: 'read', startPage, endPage }, token));
    if (type === 'copyPage') {
      const page = result.pages?.[0];
      await vscode.env.clipboard.writeText(`${page?.text || '[No extractable text; OCR may be needed.]'}${result.truncated ? '\n[Truncated]' : ''}\n\nSource: ${uri}, physical page ${startPage}`);
      await view.panel.webview.postMessage({ type: 'status', message: 'Page text and source citation copied.' }); return;
    }
    const text = markdown(uri, result);
    if (type === 'previewText') {
      const doc = await vscode.workspace.openTextDocument({ content: text, language: 'markdown' });
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true }); return;
    }
    const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(view.document.uri.fsPath.replace(/\.pdf$/i, '.extracted.md')), filters: { Markdown: ['md'] } });
    if (!target) return;
    if (target.scheme !== 'file' || !/\.md$/i.test(target.fsPath)) throw new Error('Export to a local .md file.');
    await vscode.workspace.fs.writeFile(target, Buffer.from(text));
    void vscode.window.showInformationMessage(`Exported ${basename(target.fsPath)}${result.truncated ? ' (text truncated; use smaller page ranges)' : ''}.`);
  }
  dispose(): void { [...this.registrations].reverse().forEach(item => item.dispose()); }
}
