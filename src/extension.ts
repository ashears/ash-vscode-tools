import * as vscode from 'vscode';
import type { UtilityModule } from './core/module';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (vscode.env.remoteName) {
    void vscode.window.showInformationMessage('Ash Tools currently supports local desktop windows only.');
    return;
  }
  const enabled = vscode.workspace.getConfiguration('ashTools').get<boolean>('pdf.enabled', true);
  if (enabled) {
    const { PdfModule } = await import('./modules/pdf/module');
    const module: UtilityModule = new PdfModule(context);
    context.subscriptions.push(module);
  } else {
    // Manifest contributions remain visible even when their module is disabled.
    // Explain the setting without importing PDF code or reading any document.
    const message = 'The Ash Tools PDF utility is disabled. Enable ashTools.pdf.enabled in Settings and reload VS Code.';
    const manifest = context.extension.packageJSON as { contributes: { commands: { command: string }[] } };
    for (const { command } of manifest.contributes.commands.filter(item => item.command.startsWith('ashTools.pdf.'))) {
      context.subscriptions.push(vscode.commands.registerCommand(command, () => vscode.window.showInformationMessage(message)));
    }
    context.subscriptions.push(vscode.window.registerCustomEditorProvider('ashTools.pdfViewer', {
      openCustomDocument: uri => ({ uri, dispose() {} }),
      resolveCustomEditor: (_, panel) => { panel.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'"></head><body><p>${message}</p><p>Use Reopen Editor With to choose another PDF reader.</p></body></html>`; },
    }));
  }
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('ashTools.pdf.enabled')) {
      void vscode.window.showInformationMessage('Reload VS Code to apply the Ash Tools PDF setting.', 'Reload').then(choice => {
        if (choice === 'Reload') void vscode.commands.executeCommand('workbench.action.reloadWindow');
      });
    }
  }));
}
