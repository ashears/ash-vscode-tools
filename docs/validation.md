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

These are functional checks, not an exhaustive security audit or proof of reliable extraction for every PDF. The screenshot in the README is captured from the packaged viewer in the browser harness.

## Pending launch checks

- Create the Marketplace publisher and set its ID.
- Configure the `marketplace` GitHub environment and Marketplace trusted-publishing policy.
- Verify a signed-in Copilot response against the two-page reference fixture.
- Publish 0.1.0, inspect Marketplace validation, and install the published listing.
