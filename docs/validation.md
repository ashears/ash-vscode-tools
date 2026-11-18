# Validation record

This file is updated from actual checks during implementation. GitHub CI is the source of truth for cross-platform runs. Interactive Copilot checks require the maintainer's account and are tracked separately from deterministic automated tests.

## Local checks — November 16, 2026

Environment: macOS Apple Silicon, Node 25.8.2/npm 11.11.1, VS Code 1.137.0, Chromium 159 through Playwright. The project/CI Node baseline is 24.

- Strict TypeScript and ESLint: passed.
- 14 unit/integration tests using real PDF extraction workers: passed; the recorded suite run took 1.17 seconds (not a general performance benchmark).
- Five Chromium viewer tests: passed in 2.2 seconds, including selectable text, outline navigation, search, rotation, copy-page messaging, thumbnails, refresh state, scan/error paths, and blocked command links.
- VS Code extension-host smoke: passed on macOS, including PDF custom-editor opening and direct invocation of the page-reading tool.
- The 0.1.0 VSIX installed in a temporary clean profile outside the checkout; smoke tests against those installed bytes passed with no `node_modules` or native canvas dependency available.
- Package inspection: 306 files, approximately 3.10 MiB before this validation-note update. Only runtime assets, notices, documentation, and approved media were included.
- npm audit after a packaging-tool dependency override: zero known vulnerabilities.
- A signed-in Copilot conversation and Marketplace publication have not been performed.

## GitHub validation

The [cross-platform CI run](https://github.com/ashears/ash-vscode-tools/actions/runs/43971563707) passed all four jobs: verification plus source and installed-VSIX smoke tests on Windows, Ubuntu Linux, and macOS. The initial [CodeQL analysis](https://github.com/ashears/ash-vscode-tools/actions/runs/43971009263) also passed. Later commit results remain visible in the repository's Actions tab.

The first Windows package-test run exposed a test-harness CLI-path assumption; using VS Code's official wrapper resolved it. Browser tests additionally verify selection-to-context messages and preserve the page during rapid navigation/zoom/reload.

These are functional checks, not an exhaustive security audit or proof of reliable extraction for every PDF. The screenshot in the README is captured from the packaged viewer in the browser harness.

## Publication — November 17, 2026

- [Version 0.1.0](https://marketplace.visualstudio.com/items?itemName=AshtonShears.ash-vscode-tools) is public under **AshtonShears**. Microsoft Marketplace verification completed and the listing's Install action is available.
- The [tagged publishing workflow](https://github.com/ashears/ash-vscode-tools/actions/runs/44252294442) passed validation and published through the workflow-specific OIDC policy, without a stored publishing PAT.
- The [GitHub release](https://github.com/ashears/ash-vscode-tools/releases/tag/v0.1.0) contains the published VSIX.
- A fresh install of `AshtonShears.ash-vscode-tools@0.1.0` downloaded from Marketplace into a temporary profile passed the extension-host smoke tests on macOS. Publisher/version, commands, PDF editor, and direct PDF-tool invocation were verified.
- Before publication, all 20 unit/security-policy tests, five browser scenarios, and source/installed-VSIX checks on Windows, Ubuntu, and macOS passed on the release PR. CodeQL passed.

Remaining manual verification: a signed-in Copilot conversation against the reference fixture. Automated tool invocation is verified; no model-generated answer is claimed as tested.

## Release audit review — November 17, 2026

The full audit now reports GHSA-fc5q-39xc-vjpf through development tooling. The production audit remains clean. With the owner's approval, CI uses the exact, development-only, expiring exception documented in `SECURITY.md`. This updates the November 16 audit snapshot above; a clean full audit is no longer claimed. The policy continues blocking every other moderate-or-higher advisory.
