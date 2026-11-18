import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { evaluateAudit, EXCEPTION } from './audit-policy.mjs';

// Running through npm supplies the official npm CLI path on all platforms,
// avoiding a shell and Windows .cmd argument handling.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run audit.');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
for (const scope of ['production', 'all']) {
  const args = [npmCli, 'audit', '--json', '--audit-level=moderate', ...(scope === 'production' ? ['--omit=dev'] : [])];
  let stdout;
  try {
    stdout = execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    if (error.status !== 1 || !error.stdout) throw error;
    stdout = String(error.stdout);
  }
  const result = evaluateAudit(JSON.parse(stdout), lock, scope);
  if (result.blocked.length) {
    throw new Error(`${scope} dependency audit blocked: ${result.blocked.join(', ')}. Review npm audit; do not bypass this check.`);
  }
  if (result.accepted.length) {
    console.warn(`Reviewed development-only exception: ${EXCEPTION.advisory}\nExpires ${EXCEPTION.expiresAt}; affected dependency entries: ${result.accepted.join(', ')}. This is not a clean full audit.`);
  } else console.log(`${scope} dependency audit: no moderate-or-higher advisories.`);
}
