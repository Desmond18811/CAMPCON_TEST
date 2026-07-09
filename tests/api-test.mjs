#!/usr/bin/env node
/**
 * CampusConnect API test harness — exercises every endpoint in one run.
 *
 * Built to kill the "run → error → debug → run again" loop:
 *   - never stops at the first failure: every endpoint runs, and the report at
 *     the end shows each failure with the request + response so one run gives
 *     you everything you need to debug
 *   - persists state (test user, created resource/comment IDs) in tests/.state.json,
 *     so reruns reuse the same account instead of polluting the database
 *   - dependent tests are SKIPPED (not failed) when their prerequisite failed,
 *     so you see ONE root cause instead of twenty cascading errors
 *
 * Usage:
 *   npm run test:api                      # test the deployed backend
 *   node tests/api-test.mjs --base http://localhost:3000
 *   node tests/api-test.mjs --failed      # rerun only what failed last time
 *   node tests/api-test.mjs --only resources   # run tests whose name matches
 *   node tests/api-test.mjs --keep        # don't delete created test data
 *   node tests/api-test.mjs --fresh       # start with a brand-new test user
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '.state.json');
const LAST_RUN_FILE = path.join(__dirname, '.last-run.json');

// ---------- CLI ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
    const i = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i === -1) return null;
    return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
};

const BASE = (opt('base') || process.env.API_BASE_URL || 'https://campcon-test.onrender.com').replace(/\/$/, '');
const ONLY = opt('only');
const RERUN_FAILED = flag('failed');
const KEEP = flag('keep');
const FRESH = flag('fresh');

// ---------- state ----------
let state = {};
if (!FRESH && fs.existsSync(STATE_FILE)) {
    try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { state = {}; }
}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

let lastFailed = [];
if (RERUN_FAILED && fs.existsSync(LAST_RUN_FILE)) {
    try {
        lastFailed = JSON.parse(fs.readFileSync(LAST_RUN_FILE, 'utf8'))
            .filter(r => r.status === 'FAIL').map(r => r.name);
    } catch { /* ignore */ }
}

// ---------- helpers ----------
const c = {
    green: s => `\x1b[32m${s}\x1b[0m`,
    red: s => `\x1b[31m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    dim: s => `\x1b[2m${s}\x1b[0m`,
    bold: s => `\x1b[1m${s}\x1b[0m`
};

const api = async (method, route, { body, token, form } = {}) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let requestBody;
    if (form) {
        requestBody = form; // FormData sets its own content-type boundary
    } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
    }
    const url = route.startsWith('http') ? route : `${BASE}${route}`;
    const res = await fetch(url, { method, headers, body: requestBody });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON response */ }
    return { status: res.status, json, text, headers: res.headers };
};

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);
const pngBlob = () => new Blob([PNG], { type: 'image/png' });
const txtBlob = () => new Blob([`CampusConnect api-test upload ${new Date().toISOString()}`], { type: 'text/plain' });

// Shared context — persisted IDs let `--only`/`--failed` reruns work standalone
const ctx = {
    token: state.token || null,
    email: state.email || null,
    password: state.password || null,
    username: state.username || null,
    resourceId: state.resourceId || null,
    commentId: state.commentId || null,
    secondUserId: state.secondUserId || null,
    uploadedFileUrl: state.uploadedFileUrl || null
};

class Skip extends Error { }
const need = (key, hint) => {
    if (!ctx[key]) throw new Skip(`needs ${key} (${hint})`);
    return ctx[key];
};
const expect = (cond, message) => { if (!cond) throw new Error(message); };

// ---------- test definitions (run in order) ----------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('health.root', async () => {
    const r = await api('GET', '/');
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 200)}`);
});

test('auth.register', async () => {
    if (ctx.token && ctx.email) throw new Skip('test user already exists (use --fresh to recreate)');
    const stamp = Date.now();
    const user = {
        username: `apitest${stamp}`,
        email: `apitest${stamp}@example.com`,
        password: `Test-${stamp}!`,
        school: 'API Test University'
    };
    const r = await api('POST', '/api/auth/register', { body: user });
    expect(r.status === 201, `expected 201, got ${r.status}: ${r.text.slice(0, 300)}`);
    expect(r.json?.token, 'no token in register response');
    Object.assign(ctx, { email: user.email, password: user.password, username: user.username, token: r.json.token });
    Object.assign(state, { email: user.email, password: user.password, username: user.username, token: r.json.token });
    saveState();
});

test('auth.register.duplicate-rejected', async () => {
    const email = need('email', 'run auth.register first');
    const r = await api('POST', '/api/auth/register', {
        body: { username: ctx.username, email, password: 'whatever123', school: 'X' }
    });
    expect(r.status === 409, `expected 409 for duplicate, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('auth.login', async () => {
    const email = need('email', 'run auth.register first');
    const r = await api('POST', '/api/auth/login', { body: { email, password: ctx.password } });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    expect(r.json?.token, 'no token in login response');
    ctx.token = state.token = r.json.token;
    saveState();
});

test('auth.login.wrong-password', async () => {
    const email = need('email', 'run auth.register first');
    const r = await api('POST', '/api/auth/login', { body: { email, password: 'definitely-wrong' } });
    expect(r.status === 401, `expected 401, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('auth.me', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/auth/me', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    expect(r.json?.data?.email === ctx.email, `wrong user returned: ${r.json?.data?.email}`);
});

test('auth.me.rejects-missing-token', async () => {
    const r = await api('GET', '/api/auth/me');
    expect(r.status === 401, `expected 401, got ${r.status}`);
});

test('auth.logout', async () => {
    const r = await api('GET', '/api/auth/logout');
    expect(r.status === 200, `expected 200, got ${r.status}`);
});

test('auth.forgot-password', async () => {
    const email = need('email', 'run auth.register first');
    const r = await api('POST', '/api/auth/forgot-password', { body: { email } });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('auth.reset-password.rejects-bad-token', async () => {
    const r = await api('POST', '/api/auth/reset-password/not-a-real-token', {
        body: { password: 'newpass123', confirmPassword: 'newpass123' }
    });
    expect(r.status === 400, `expected 400, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('users.profile.get', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/users/profile', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('users.profile.update-with-picture', async () => {
    const token = need('token', 'login failed');
    const form = new FormData();
    form.append('bio', `Updated by api-test at ${new Date().toISOString()}`);
    form.append('profilePic', pngBlob(), 'api-test-avatar.png');
    const r = await api('PUT', '/api/users/profile', { token, form });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    const pic = r.json?.data?.profilePic;
    expect(pic && pic.startsWith('http'), `profilePic is not an absolute URL: ${pic}`);
});

test('users.checkpoint.save', async () => {
    const token = need('token', 'login failed');
    const r = await api('PATCH', '/api/users/checkpoint', { token, body: { checkpoint: '/explore' } });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('users.checkpoint.rejects-bad-path', async () => {
    const token = need('token', 'login failed');
    const r = await api('PATCH', '/api/users/checkpoint', { token, body: { checkpoint: 'not-a-path' } });
    expect(r.status === 400, `expected 400, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.create-with-upload', async () => {
    const token = need('token', 'login failed');
    const form = new FormData();
    form.append('title', `API test resource ${Date.now()}`);
    form.append('subject', 'Testing');
    form.append('gradeLevel', '400');
    form.append('description', 'Created by the api-test harness');
    form.append('file', txtBlob(), 'api-test-notes.txt');
    form.append('image', pngBlob(), 'api-test-cover.png');
    const r = await api('POST', '/api/resources', { token, form });
    expect([200, 201].includes(r.status), `expected 200/201, got ${r.status}: ${r.text.slice(0, 400)}`);
    const id = r.json?.data?._id;
    expect(id, `no resource id in response: ${r.text.slice(0, 300)}`);
    const fileUrl = r.json?.data?.fileUrl;
    expect(fileUrl && fileUrl.startsWith('http'), `fileUrl is not absolute: ${fileUrl}`);
    ctx.resourceId = state.resourceId = id;
    ctx.uploadedFileUrl = state.uploadedFileUrl = fileUrl;
    saveState();
});

test('files.uploaded-file-is-viewable', async () => {
    const url = need('uploadedFileUrl', 'resource create failed');
    const r = await fetch(url);
    const bytes = (await r.arrayBuffer()).byteLength;
    expect(r.status === 200, `expected 200 fetching ${url}, got ${r.status}`);
    expect(bytes > 0, 'file is empty');
});

test('resources.list', async () => {
    const r = await api('GET', '/api/resources');
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    expect(Array.isArray(r.json?.data), 'data is not an array');
});

test('resources.get-one', async () => {
    const id = need('resourceId', 'resource create failed');
    const r = await api('GET', `/api/resources/${id}`);
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.update', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const form = new FormData();
    form.append('title', `API test resource (edited ${Date.now()})`);
    const r = await api('PUT', `/api/resources/${id}`, { token, form });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 400)}`);
});

test('resources.like', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const r = await api('POST', `/api/resources/${id}/like`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.save', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const r = await api('POST', `/api/resources/${id}/save`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.rate', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const r = await api('POST', `/api/resources/${id}/rate`, { token, body: { rating: 4, comment: 'api-test rating' } });
    expect([200, 201].includes(r.status), `expected 200/201, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.liked-list', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/resources/liked', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.saved-list', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/resources/saved', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.recommended', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/resources/recommended', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.views', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const r = await api('GET', `/api/resources/${id}/views`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('resources.ratings', async () => {
    const id = need('resourceId', 'resource create failed');
    const r = await api('GET', `/api/resources/${id}/ratings`);
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('comments.create', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const r = await api('POST', `/api/comments/${id}/comments`, { token, body: { text: 'api-test comment' } });
    expect([200, 201].includes(r.status), `expected 200/201, got ${r.status}: ${r.text.slice(0, 300)}`);
    const commentId = r.json?.data?._id;
    expect(commentId, `no comment id in response: ${r.text.slice(0, 300)}`);
    ctx.commentId = state.commentId = commentId;
    saveState();
});

test('comments.list', async () => {
    const id = need('resourceId', 'resource create failed');
    const token = need('token', 'login failed');
    const r = await api('GET', `/api/comments/${id}/comments`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('comments.update', async () => {
    const id = need('commentId', 'comment create failed');
    const token = need('token', 'login failed');
    const r = await api('PUT', `/api/comments/comments/${id}`, { token, body: { text: 'api-test comment (edited)' } });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('comments.like', async () => {
    const id = need('commentId', 'comment create failed');
    const token = need('token', 'login failed');
    const r = await api('POST', `/api/comments/comments/${id}/like`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('comments.dislike', async () => {
    const id = need('commentId', 'comment create failed');
    const token = need('token', 'login failed');
    const r = await api('POST', `/api/comments/comments/${id}/dislike`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('notifications.list', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/notifications', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    ctx.notificationId = r.json?.data?.[0]?._id || null;
});

test('notifications.mark-one-read', async () => {
    const token = need('token', 'login failed');
    if (!ctx.notificationId) throw new Skip('no notifications exist for the test user');
    const r = await api('PUT', `/api/notifications/${ctx.notificationId}/read`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('notifications.mark-all-read', async () => {
    const token = need('token', 'login failed');
    const r = await api('PUT', '/api/notifications/read-all', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('subscribe.create', async () => {
    const r = await api('POST', '/api/subscribe', { body: { email: `apitest-sub-${Date.now()}@example.com` } });
    expect([200, 201].includes(r.status), `expected 200/201, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('subscribe.count', async () => {
    const r = await api('GET', '/api/subscribe/count');
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('subscribe.all', async () => {
    const r = await api('GET', '/api/subscribe/all');
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

// NOTE: POST /api/subscribe/notify-launch is intentionally NOT tested —
// it emails every real subscriber.

test('block.setup-second-user', async () => {
    if (ctx.secondUserId) throw new Skip('second user already exists');
    const stamp = Date.now();
    const r = await api('POST', '/api/auth/register', {
        body: {
            username: `apitestblock${stamp}`,
            email: `apitestblock${stamp}@example.com`,
            password: `Test-${stamp}!`,
            school: 'API Test University'
        }
    });
    expect(r.status === 201, `expected 201, got ${r.status}: ${r.text.slice(0, 300)}`);
    ctx.secondUserId = state.secondUserId = r.json?.data?._id;
    saveState();
    expect(ctx.secondUserId, 'no user id in register response');
});

test('block.block-user', async () => {
    const token = need('token', 'login failed');
    const target = need('secondUserId', 'second user setup failed');
    const r = await api('POST', `/api/users/${target}/block`, { token });
    expect([200, 201].includes(r.status), `expected 200/201, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('block.list', async () => {
    const token = need('token', 'login failed');
    const r = await api('GET', '/api/users/blocked', { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

test('block.unblock-user', async () => {
    const token = need('token', 'login failed');
    const target = need('secondUserId', 'second user setup failed');
    const r = await api('DELETE', `/api/users/${target}/unblock`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
});

// ---------- cleanup (still reported like tests) ----------
test('cleanup.delete-comment', async () => {
    if (KEEP) throw new Skip('--keep flag set');
    const id = need('commentId', 'nothing to clean up');
    const token = need('token', 'login failed');
    const r = await api('DELETE', `/api/comments/comments/${id}`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    ctx.commentId = state.commentId = null;
    saveState();
});

test('cleanup.delete-resource', async () => {
    if (KEEP) throw new Skip('--keep flag set');
    const id = need('resourceId', 'nothing to clean up');
    const token = need('token', 'login failed');
    const r = await api('DELETE', `/api/resources/${id}`, { token });
    expect(r.status === 200, `expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    ctx.resourceId = state.resourceId = null;
    ctx.uploadedFileUrl = state.uploadedFileUrl = null;
    saveState();
});

// ---------- runner ----------
// Setup tests always run (everything else depends on them), even under --only/--failed
const ALWAYS_RUN = new Set(['auth.register', 'auth.login']);

const shouldRun = (name) => {
    if (ALWAYS_RUN.has(name)) return true;
    if (RERUN_FAILED) return lastFailed.includes(name);
    if (ONLY) return name.includes(ONLY);
    return true;
};

const results = [];
console.log(c.bold(`\nCampusConnect API tests → ${BASE}`));
console.log(c.dim(`state: ${fs.existsSync(STATE_FILE) && !FRESH ? 'reusing tests/.state.json' : 'fresh'}${RERUN_FAILED ? ` | rerunning ${lastFailed.length} failed` : ''}${ONLY ? ` | only: *${ONLY}*` : ''}\n`));

for (const t of tests) {
    if (!shouldRun(t.name)) {
        results.push({ name: t.name, status: 'FILTERED' });
        continue;
    }
    const started = Date.now();
    try {
        await t.fn();
        const ms = Date.now() - started;
        results.push({ name: t.name, status: 'PASS', ms });
        console.log(`  ${c.green('✓ PASS')}  ${t.name} ${c.dim(`(${ms}ms)`)}`);
    } catch (err) {
        if (err instanceof Skip) {
            results.push({ name: t.name, status: 'SKIP', reason: err.message });
            console.log(`  ${c.yellow('- SKIP')}  ${t.name} ${c.dim(`— ${err.message}`)}`);
        } else {
            const ms = Date.now() - started;
            results.push({ name: t.name, status: 'FAIL', ms, error: err.message });
            console.log(`  ${c.red('✗ FAIL')}  ${t.name} ${c.dim(`(${ms}ms)`)}\n          ${c.red(err.message)}`);
        }
    }
}

// ---------- report ----------
const ran = results.filter(r => r.status !== 'FILTERED');
const passed = ran.filter(r => r.status === 'PASS').length;
const failed = ran.filter(r => r.status === 'FAIL');
const skipped = ran.filter(r => r.status === 'SKIP').length;

fs.writeFileSync(LAST_RUN_FILE, JSON.stringify(results, null, 2));

console.log(c.bold(`\n${passed} passed, ${failed.length} failed, ${skipped} skipped (${ran.length} run, ${tests.length} total)`));
if (failed.length) {
    console.log(c.red('\nFailures:'));
    for (const f of failed) console.log(`  ${c.red('✗')} ${f.name}: ${f.error}`);
    console.log(c.dim('\nRerun just these with: node tests/api-test.mjs --failed'));
}
console.log(c.dim(`Full results: tests/.last-run.json | test user: ${ctx.email || 'none'}\n`));

process.exit(failed.length ? 1 : 0);
