import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.vscode-test/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly' } } }
);
