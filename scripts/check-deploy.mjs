// Deployment health check: fetches a deployed TAK-FLOW client and asserts it
// serves the real build. Usage:
//   node scripts/check-deploy.mjs <deploy-url>
//   DEPLOY_URL=https://... npm run check:deploy
const url = process.argv[2] || process.env.DEPLOY_URL;
if (!url) {
    console.error('check-deploy: pass a URL (arg or DEPLOY_URL env)');
    process.exit(1);
}

const target = url.replace(/\/$/, '');
try {
    const response = await fetch(target, { redirect: 'follow' });
    if (!response.ok) {
        console.error(`check-deploy FAIL: ${target} -> HTTP ${response.status}`);
        process.exit(1);
    }
    const html = await response.text();
    const markers = ['TAK-FLOW', 'canvas-container'];
    const missing = markers.filter((marker) => !html.includes(marker));
    if (missing.length > 0) {
        console.error(`check-deploy FAIL: ${target} responded but is missing markers: ${missing.join(', ')}`);
        process.exit(1);
    }
    console.log(`check-deploy OK: ${target} serves the TAK-FLOW client (markers: ${markers.join(', ')})`);
} catch (err) {
    console.error(`check-deploy FAIL: ${target} unreachable (${err.message})`);
    process.exit(1);
}
