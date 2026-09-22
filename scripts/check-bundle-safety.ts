/**
 * Post-build safety check: scans dist/ for anything that would blow the
 * app's cover or leak secrets. Run after `npm run build`.
 *
 *   npx tsx scripts/check-bundle-safety.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = join(process.cwd(), 'dist');

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Notification.requestPermission', pattern: /Notification\.requestPermission/ },
  { label: 'PushManager', pattern: /\bPushManager\b/ },
  { label: 'pushManager', pattern: /\bpushManager\b/ },
  { label: 'firebase-messaging', pattern: /firebase-messaging/ },
  { label: 'onesignal', pattern: /onesignal/i },
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  let files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

function main() {
  let ok = true;
  const files = walk(DIST_DIR).filter((f) => /\.(js|html|css|webmanifest)$/.test(f));

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');

    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`FAIL: found "${label}" in ${file}`);
        ok = false;
      }
    }

    if (/service_role/i.test(content)) {
      console.error(`FAIL: found "service_role" reference in ${file}`);
      ok = false;
    }

    const devCode = process.env.VITE_DEV_UNLOCK_CODE;
    if (devCode && content.includes(devCode)) {
      console.error(`FAIL: found VITE_DEV_UNLOCK_CODE value in ${file}`);
      ok = false;
    }
  }

  if (!ok) {
    console.error('\nBundle safety check FAILED.');
    process.exit(1);
  }

  console.log(`Bundle safety check passed (${files.length} files scanned).`);
}

main();
