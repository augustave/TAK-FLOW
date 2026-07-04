// TP-008: prevent silent growth of the main client bundle.
// Run after `npm run build`. Warns above WARN_KB, fails above FAIL_KB.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const WARN_KB = 700;
const FAIL_KB = 780;

const assetsDir = path.resolve('dist/assets');
let entries;
try {
    entries = readdirSync(assetsDir).filter((name) => /^index-.*\.js$/.test(name));
} catch (err) {
    console.error(`bundle budget: cannot read ${assetsDir} — run \`npm run build\` first (${err.message})`);
    process.exit(1);
}

if (entries.length !== 1) {
    console.error(`bundle budget: expected exactly one dist/assets/index-*.js, found ${entries.length} (${entries.join(', ')})`);
    process.exit(1);
}

const file = entries[0];
const bytes = statSync(path.join(assetsDir, file)).size;
const kb = bytes / 1024;
const summary = `${file}: ${kb.toFixed(1)} KB (warn ${WARN_KB} KB, fail ${FAIL_KB} KB)`;

if (kb > FAIL_KB) {
    console.error(`bundle budget FAIL: ${summary}`);
    process.exit(1);
}
if (kb > WARN_KB) {
    console.warn(`bundle budget WARN: ${summary}`);
} else {
    console.log(`bundle budget OK: ${summary}`);
}
