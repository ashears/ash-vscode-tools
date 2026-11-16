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
  }
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('ashTools.pdf.enabled')) {
      void vscode.window.showInformationMessage('Reload VS Code to apply the Ash Tools PDF setting.', 'Reload').then(choice => {
        if (choice === 'Reload') void vscode.commands.executeCommand('workbench.action.reloadWindow');
      });
    }
  }));
}
