# Security policy

For suspected vulnerabilities, use this repository's **Security → Report a vulnerability** when available. Do not put private documents, credentials, or exploit payloads containing secrets into public issues. Only the latest published release will receive fixes; until first publication, the supported code is `main`.

## Boundaries

The PDF utility reads local files and has no extension-owned network requests or telemetry. Its PDF.js assets are bundled. A restrictive webview CSP disallows arbitrary scripts, embedded objects, and remote resources; narrowly scoped local roots expose packaged assets only. Form editing and PDF scripting are not enabled. PDF.js 6 removed the former parser JavaScript-evaluation option; the extension does not enable eval or attach a scripting manager. WASM execution is allowed for bundled decoders, separately from JavaScript eval.

The extraction worker uses PDF.js's compatibility build in a separate Node worker. Jobs are serialized, cancellable, time limited, and capped in file size, page count, output, heap target, and result-cache size. Worker limits reduce resource exhaustion risk; they are not a security sandbox or a hard total-process memory limit.

Tool input cannot grant filesystem access. Workspace roots and explicitly opened documents are canonicalized with `realpath`; outside symlink targets are rejected unless explicitly opened. Reads use a file handle, final-component no-follow where supported, bounded allocation, and before/after checks. Local filesystem races and a malicious process with access to your account are outside the extension's isolation guarantees. Tool access is rechecked after IO and extraction. Revoked workspace trust prevents cached results from being returned.

Outside-file grants last for the extension session, even after a tab closes. Only view state is persisted (source URI, page, zoom, rotation; up to 100 files), in VS Code workspace storage. PDF bytes and extracted-text caches are memory-only. Text is persisted only when you explicitly export, copy it into another application, or pass it to Copilot. Export destination and overwrite confirmation use VS Code's save dialog.

PDF text and metadata can contain prompt injection. Tool output labels them untrusted and supplies page citations, but cannot guarantee a model will ignore malicious instructions. Tool use puts content into Copilot's chat context and is governed by the configured model/provider policies.

## Supply chain and release

Dependabot covers npm and Actions. CI runs lint, types, tests, package checks, and npm audit. CodeQL scans TypeScript/JavaScript. Public-repository secret protection should be enabled in GitHub settings. Actions use immutable references and least-privilege permissions; PR jobs do not receive publishing credentials. Tagged releases are validated for version and `main` ancestry. Marketplace publishing uses a workflow-bound OIDC policy rather than a long-lived PAT.

An extension you maintain is not automatically safe. Review upstream dependencies, restrict who can change workflows/tags, and keep your GitHub and Microsoft accounts protected with MFA.

## Temporary development dependency exception

The owner approved an exception for [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), a high-severity repeated-extglob denial of service in **picomatch 4.0.7**, on November 17, 2026. The advisory has no patched release at approval time. This dependency is used by build/test/packaging tools and is excluded from the VSIX. Current glob patterns are repository-controlled; a crafted pattern can still hang tooling. CI jobs have timeouts and untrusted PR jobs receive no publishing credentials.

`npm run audit` separately audits production dependencies with no exceptions, then checks the full dependency report. Only this exact advisory, at the reviewed version and on lockfile paths marked development-only, plus entries inheriting solely that advisory, can pass. Every other moderate-or-higher advisory blocks. Registry/report errors fail closed. Standard `npm audit` continues to report the issue; the custom check prints the accepted exception explicitly.

The exception expires **December 1, 2026 at 00:00 America/Los_Angeles** (`2026-12-01T08:00:00Z`). Builds fail for this advisory after that deadline; installed extensions are unaffected. Remove the exception after updating to a patched upstream release. A new version, expanded production exposure, different advisory, or changed risk requires another review. The policy is in `scripts/audit-policy.mjs`, with tests for expiry, production exposure, new advisories, malformed reports, and dependency cycles.
