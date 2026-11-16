import { runTests } from '@vscode/test-electron';
import { resolve } from 'node:path';
const root = resolve('.');
await runTests({
  extensionDevelopmentPath: root,
  extensionTestsPath: resolve('dist/test-host.cjs'),
  vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH || undefined,
  version: process.env.VSCODE_VERSION || '1.137.0',
  extensionTestsEnv: { ASH_EXTENSION_ROOT: root },
  launchArgs: [resolve('test/fixtures'), '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', '--no-sandbox', '--user-data-dir', resolve('.vscode-test/profile')],
});
