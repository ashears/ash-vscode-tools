# Project case study

## Problem

I wanted a small set of VS Code utilities whose behavior and release process I could inspect and maintain myself. The first use case was reading technical PDFs beside code and making their text available to Copilot with verifiable page references.

## Design decisions

- One extension with internal modules keeps installation simple while leaving room for distinct utilities. A tiny disposable interface provides ownership without a general plugin framework.
- PDF.js handles parsing/rendering; I maintain the integration rather than implementing a PDF engine. Package-managed updates and preserved upstream notices make that dependency visible.
- The viewer and extraction worker are separate. Text tools work without a preview tab, and parsing avoids blocking the extension host.
- Workspace/file authorization precedes extraction, including cached reads. Documents opened explicitly outside the workspace get a session-only grant. No automatic document indexing or upload is performed.
- Page-bounded outputs make citations and truncation visible. OCR and reliable layout reconstruction are deferred rather than being claimed inaccurately.
- Standard public CI runners and a backend-free runtime support a zero-spend maintenance model. OIDC removes stored Marketplace publishing credentials.

## Evidence

Tests use original fixtures for text, columns, scans, encrypted files, malformed files, long documents, and dense text. They verify extraction, page boundaries, search/truncation, cancellation, file changes, workspace trust, symlink escapes, malformed inputs, browser controls, and package contents. The CI host matrix targets Windows, macOS, and Linux.

Measured local results and remaining manual verification are recorded in [validation](validation.md). CI badges reflect actual runs, not claims of security or quality guarantees. No user-adoption, performance-improvement, or employment-impact numbers are asserted.

## Interview discussion

Explain the custom editor/message boundary, the shared extraction service, the difference between tool authorization and model behavior, why canonical paths matter, how cancellation disposes workers, and how immutable workflow actions and OIDC reduce release risks. Discuss the limits of text extraction and the costs of adding OCR or browser support.

An accurate resume description after publication would be: “Built and published a modular TypeScript VS Code extension with local PDF viewing, page-cited Copilot tools, cross-platform tests, and OIDC-based release automation.” Omit “published” until publication is complete, and add metrics only after measuring them.
