# Contributing

Use Node 24 and `npm ci --ignore-scripts`. Run `npm run check`, `npm run test:ui`, and `npm run test:host` before opening a PR. Do not add telemetry, paid runtime services, runtime-downloaded code, or unnecessary dependencies.

## Add a utility

1. Create `src/modules/<utility>/` with a class implementing `UtilityModule` from `src/core/module.ts`.
2. Keep commands, settings, tests, UI, and resources owned by that module. Register every disposable and release it in `dispose()`.
3. Add an application-scoped `ashTools.<utility>.enabled` setting with reload semantics. Add a lazy import to `activate` only when the module is enabled.
4. Declare commands, editor types, tool schemas, and their activation contributions in `package.json`. Use stable VS Code APIs and unique `ashTools` names.
5. Put pure behavior tests in `test/unit`; extend extension-host or UI checks for integration behavior. Document any new filesystem or network access.

The shared core is intentionally small. Add shared code only when at least two modules need it. Modules must not import each other's implementation details.

## Dependencies

Review each Dependabot PR's upstream diff, release notes, license changes, lifecycle scripts, and transitive dependencies. Keep action references pinned to full SHAs with a readable version comment. No automated merges or releases from dependency PRs. `@vscode/vsce` currently needs a patched `minimatch` override; remove it once upstream's supported range includes the fix and package verification passes.

Run `npm run audit` for the release audit policy. Its single, temporary development-only picomatch exception is documented in `SECURITY.md`; do not replace this with a blanket audit bypass. Standard `npm audit` still shows the acknowledged advisory.

## Original fixtures

Run `npm run fixtures` to regenerate the synthetic PDFs and code-drawn icon. Fixtures are original MIT-licensed material, with no private documents. PDF creation timestamps may change; regeneration should be deliberate. `protected.pdf` uses password `test-password` solely to exercise the unsupported-file path. `npm run test:ui` captures `media/demo.png` from the real viewer.
