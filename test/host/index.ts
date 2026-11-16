import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { join } from 'node:path';

export async function run(): Promise<void> {
  const extension = vscode.extensions.all.find(item => item.packageJSON.name === 'ash-vscode-tools');
  assert.ok(extension, 'Extension must be installed or loaded in development mode.');
  if (process.env.ASH_INSTALLED_TEST) {
    assert.notEqual(extension.extensionPath, process.env.ASH_EXTENSION_ROOT, 'Must test the installed VSIX, not source.');
    const { existsSync } = await import('node:fs');
    assert.equal(existsSync(join(extension.extensionPath, 'node_modules')), false, 'No native or npm runtime dependencies should be installed.');
  }
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  for (const name of ['open', 'openAtPage', 'copyPage', 'copySelection', 'previewText', 'exportMarkdown']) {
    assert.ok(commands.includes(`ashTools.pdf.${name}`), `Missing command: ${name}`);
  }
  const disabled = vscode.workspace.getConfiguration('ashTools').get('pdf.enabled') === false;
  assert.equal(disabled, false);
  const uri = vscode.Uri.file(join(process.env.ASH_EXTENSION_ROOT ?? extension.extensionPath, 'test', 'fixtures', 'reference.pdf'));
  await vscode.commands.executeCommand('vscode.openWith', uri, 'ashTools.pdfViewer');
  const tab = vscode.window.tabGroups.all.flatMap(group => group.tabs).find(tab => tab.input instanceof vscode.TabInputCustom && tab.input.viewType === 'ashTools.pdfViewer');
  assert.ok(tab, 'Read-only PDF editor must open.');
  if (vscode.workspace.isTrusted) {
    for (const name of ['ashTools_pdfInfo', 'ashTools_pdfSearch', 'ashTools_pdfReadPages']) assert.ok(vscode.lm.tools.some(tool => tool.name === name));
    const result = await vscode.lm.invokeTool('ashTools_pdfReadPages', { input: { uri: uri.toString(), startPage: 1, endPage: 1 }, toolInvocationToken: undefined });
    const text = result.content.filter(part => part instanceof vscode.LanguageModelTextPart).map(part => part.value).join('');
    assert.match(text, /250 milliseconds/); assert.match(text, /physical page 1/);
  }
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  console.log('Extension host: commands, PDF custom editor, and registered tools verified.');
}
