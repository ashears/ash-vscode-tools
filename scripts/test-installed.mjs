import { downloadAndUnzipVSCode, runTests, runVSCodeCommand } from '@vscode/test-electron';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, rm, mkdtemp, readdir } from 'node:fs/promises';
const root = resolve('.');
// Outside the checkout: the installed worker must not find dev-only native
// libraries by walking up to this repository's node_modules.
const temp = await mkdtemp(join(tmpdir(), 'ash-installed-'));
const extensions = join(temp, 'extensions'), profile = join(temp, 'profile');
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const executable = process.env.VSCODE_EXECUTABLE_PATH || await downloadAndUnzipVSCode(process.env.VSCODE_VERSION || '1.137.0');
const cli = process.platform === 'darwin' ? resolve(dirname(executable), '../Resources/app/out/cli.js') : resolve(dirname(executable), 'resources/app/out/cli.js');
try {
const installArgs = ['--user-data-dir', profile, '--extensions-dir', extensions, '--install-extension', resolve(`ash-vscode-tools-${manifest.version}.vsix`), '--force'];
if (process.env.VSCODE_EXECUTABLE_PATH && process.platform !== 'win32') {
  execFileSync(executable, [cli, ...installArgs], { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
} else {
  // Use the distribution's official CLI wrapper on Windows: resources can be
  // packaged differently across VS Code platforms and versions.
  const result = await runVSCodeCommand(installArgs, { version: process.env.VSCODE_VERSION || '1.137.0', reuseMachineInstall: true });
  console.log(result.stdout);
}
const installed = (await readdir(extensions)).find(name => name.startsWith(`${manifest.publisher}.${manifest.name}-`));
if (!installed) throw new Error('VSIX was not installed into the clean profile.');
await runTests({
  // VS Code requires a development path to dispatch --extensionTestsPath. Point
  // it at the installed VSIX bytes, never at the source checkout.
  vscodeExecutablePath: executable, extensionDevelopmentPath: join(extensions, installed), extensionTestsPath: resolve('dist/test-host.cjs'),
  extensionTestsEnv: { ASH_EXTENSION_ROOT: root, ASH_INSTALLED_TEST: '1' },
  launchArgs: [resolve('test/fixtures'), '--user-data-dir', profile, '--extensions-dir', extensions, '--disable-workspace-trust', '--no-sandbox'],
});
} finally { await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
