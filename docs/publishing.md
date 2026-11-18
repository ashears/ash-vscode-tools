# Publish your first VS Code extension

The source repository is [ashears/ash-vscode-tools](https://github.com/ashears/ash-vscode-tools). Its Marketplace publisher ID is **AshtonShears**. The repository does not automatically create a Marketplace account or trusted-publishing policy.

## 1. Create the publisher

1. Sign into [Marketplace publisher management](https://marketplace.visualstudio.com/manage) with your Microsoft account. Complete any requested account onboarding and publisher agreement.
2. Create a publisher. Choose an ID you want to keep, such as an available variation of your GitHub identity; this becomes part of the permanent extension identity `<publisher>.ash-vscode-tools`. The display name can differ.
3. Set `publisher` in `package.json` to that exact ID. The placeholder `publisher-not-configured` allows local packaging but deliberately fails release validation. No domain purchase is needed; a verified-domain badge is optional and is not a requirement for this project.
   When switching to the real publisher ID, uninstall the placeholder-identity development VSIX to avoid having two copies of the reader installed.
4. Review author, repository links, description, icon, README screenshot, license, and changelog. Do not claim publication or installs before the listing exists.

Read Microsoft's [publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for current account requirements.

## 2. Configure GitHub and Marketplace trusted publishing

1. On GitHub, create an environment named **`marketplace`** under repository **Settings → Environments**. Restrict its deployment tags to `v*`; optionally require a human reviewer. Do not require approval from a second person you do not have available.
2. In Marketplace publisher management, open your publisher, select **Trusted Publishing → Create**, and enter:

   | Field | Value |
   | --- | --- |
   | Repository owner | `ashears` |
   | Repository | `ash-vscode-tools` |
   | Workflow | `publish.yml` |
   | Environment | `marketplace` |

3. Keep account MFA enabled. Do **not** create a publishing PAT. The workflow requests a short-lived OIDC identity with `id-token: write` and invokes `vsce publish --oidc`.
4. Protect `main` with required CI checks and disallow force pushes/deletions. Keep dependency merges manual. Restrict release-tag creation to maintainers where your repository settings support that rule.
5. In **Settings → Code security**, enable Dependabot alerts/security updates, secret scanning/push protection when offered, and private vulnerability reporting. The committed CodeQL workflow supplies code scanning; avoid enabling duplicate default setup alongside it.
6. Under GitHub billing/budgets, keep paid Actions/storage spending blocked. Use public repositories and standard runners, never larger runners. This project does not retain Actions artifacts or caches and requires no hosted service. Recheck current [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) if changing the workflows or repo visibility.

The workflow rejects the placeholder publisher, a mismatched tag/version, or a tag commit outside `main` ancestry. Environment and trusted-publishing policies are account settings, not files that Git can apply.

## 3. Verify the installable package

```sh
npm ci --ignore-scripts
npm run check
npx playwright install chromium
npm run test:ui
npm run test:host
npm run package
node scripts/check-vsix.mjs
npm run test:installed
```

Use **Extensions → … → Install from VSIX…** and select `ash-vscode-tools-0.1.0.vsix`. For a clean test profile, use the `code` CLI with a temporary `--user-data-dir` and `--extensions-dir`, then install with `--install-extension <absolute-vsix-path>`. The CLI may need to be added to PATH from VS Code's command palette on macOS.

- Open the reference fixture, check selectable text/search/outline/thumbnails, navigate to page 2, rotate and zoom.
- Copy a page and selection; inspect citations. Preview/export a page range and verify the destination content.
- Change a source PDF, confirm refresh, then reopen its tab to check remembered page/zoom.
- Open the scan, malformed, and protected fixtures and inspect their messages.
- In Restricted Mode, check viewing works and tools refuse access.
- In Copilot Agent mode, enable the PDF tools and ask the README's fixture question. Verify 250 milliseconds/page 1 and 30 seconds/page 2 in the reader.
- Confirm the viewer works without a Copilot account. Review README limitations before launch.

The browser harness and host smoke tests do not replace the final interactive Copilot verification, which requires your signed-in account.

## 4. Release 0.1.0

Merge the publisher-ID and launch-documentation changes into `main`. Confirm the GitHub CI and CodeQL checks are green. Update the changelog and README status truthfully as part of launch.

```sh
git switch main
git pull --ff-only
git tag v0.1.0
git push origin v0.1.0
```

The publish workflow reruns validation, builds the VSIX, checks its contents, publishes through OIDC, and creates a GitHub release containing that VSIX. Watch both workflow logs and Marketplace validation status. Install the published listing once it is available and add its verified URL to the README.

If OIDC setup is unavailable or onboarding blocks the first publication, package locally and manually upload the same VSIX through Marketplace management, as described in Microsoft's guide. Do not add a long-lived credential as a shortcut.

## 5. Ship updates and recover

Review Dependabot changes, test, update `CHANGELOG.md`, and run `npm version patch --no-git-tag-version` to update the manifest/lockfile. Commit through a PR. Tag the merged version on `main` and push that tag. Installed extensions update through VS Code's normal Marketplace mechanism.

If a published version has a bug, release a corrected higher patch version. Do not overwrite an existing version, retag a release, or unpublish/recreate the extension to roll back. If Marketplace publication succeeds but GitHub release creation fails, attach the already-built VSIX manually after verifying its version/checksum; do not republish different bytes under the same version.
