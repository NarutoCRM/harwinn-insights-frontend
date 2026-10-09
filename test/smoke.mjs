const frontend = process.env.FRONTEND_URL || 'http://127.0.0.1:4173';
const backend = process.env.BACKEND_URL || 'http://localhost:3000';
const checks = [
  ['health', `${backend}/health`, 200],
  ['readiness', `${backend}/ready`, 200],
  ['public site', `${frontend}/`, 200],
  ['login route', `${frontend}/admin/login`, 200],
  ['records route', `${frontend}/admin/records`, 200],
  ['projects route', `${frontend}/admin/projects`, 200],
  ['outcome route', `${frontend}/tracking/DEMO/COMPLETE`, 200],
  ['proxied protected projects', `${frontend}/api/projects`, 401],
  ['proxied protected records', `${frontend}/api/records`, 401],
  ['proxied callback validation (no write)', `${frontend}/redirect/DEMO/COMPLETE`, 400],
];
let failed = 0;
for (const [name, url, expected] of checks) {
  const response = await fetch(url);
  const good = response.status === expected;
  console.log(`${good ? 'PASS' : 'FAIL'} ${name}: HTTP ${response.status} (expected ${expected})`);
  if (!good) failed++;
}
const html = await (await fetch(`${frontend}/`)).text();
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
for (const asset of assets) {
  const response = await fetch(frontend + asset);
  const good = response.status === 200;
  console.log(`${good ? 'PASS' : 'FAIL'} production asset: HTTP ${response.status}`);
  if (!good) failed++;
}
if (!assets.length) { console.log('FAIL no production assets found'); failed++; }
console.log(`${checks.length + assets.length - failed} passed; ${failed} failed`);
process.exitCode = failed ? 1 : 0;

