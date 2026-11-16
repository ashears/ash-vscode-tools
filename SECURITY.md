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
