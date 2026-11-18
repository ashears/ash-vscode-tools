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

## Pending launch checks

- Marketplace publisher **AshtonShears** is created and configured in the manifest.
- The `marketplace` GitHub environment and workflow-specific Marketplace trusted-publishing policy are active.
- Verify a signed-in Copilot response against the two-page reference fixture.
- Publish 0.1.0, inspect Marketplace validation, and install the published listing.

## Release audit review — November 17, 2026

The full audit now reports GHSA-fc5q-39xc-vjpf through development tooling. The production audit remains clean. With the owner's approval, CI uses the exact, development-only, expiring exception documented in `SECURITY.md`. This updates the November 16 audit snapshot above; a clean full audit is no longer claimed. The policy continues blocking every other moderate-or-higher advisory.
