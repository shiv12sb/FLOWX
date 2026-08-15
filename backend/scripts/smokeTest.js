const http = require('http');
const https = require('https');
const { URL } = require('url');
let WebSocket;
try {
  WebSocket = require('ws').WebSocket;
} catch (e) {
  WebSocket = null;
}

async function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;
      const method = (opts.method || 'GET').toUpperCase();
      const headers = opts.headers || {};
      const body = opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : null;
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (isHttps ? 443 : 80),
          path: u.pathname + u.search,
          method,
          headers
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              text: async () => data,
              json: async () => {
                try { return JSON.parse(data); } catch (e) { return null; }
              }
            });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    } catch (e) { reject(e); }
  });
}

const PORT = process.env.PORT || 3000;
const HOST = `http://localhost:${PORT}`;

async function testOptimize() {
  try {
    const res = await fetch(`${HOST}/api/routes/optimize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: 'Sitabuldi', destination: 'MIHAN' })
    });
    const json = await res.json();
    console.log('/api/routes/optimize', res.status, json && json.success ? 'OK' : 'FAIL', json && json.data ? `routes:${(json.data.all||[]).length}` : '');
  } catch (e) { console.error('optimize error', e.message); }
}

async function testOptimizeWithPrediction() {
  try {
    const res = await fetch(`${HOST}/api/routes/optimize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: 'Sitabuldi', destination: 'MIHAN', usePrediction: true })
    });
    const json = await res.json();
    console.log('/api/routes/optimize (with prediction)', res.status, json && json.success ? 'OK' : 'FAIL', json && json.data ? `routes:${(json.data.all||[]).length}` : '');
  } catch (e) { console.error('optimize-with-prediction error', e.message); }
}

async function testPredictions() {
  try {
    const res = await fetch(`${HOST}/api/predictions/network`);
    const json = await res.json();
    const ok = json && json.success && json.data && typeof json.data === 'object';
    console.log('/api/predictions/network', res.status, ok ? 'OK' : 'FAIL');
  } catch (e) { console.error('predictions error', e.message); }
}

async function testIncidentsList() {
  try {
    const res = await fetch(`${HOST}/api/incidents`);
    const json = await res.json();
    console.log('/api/incidents', res.status, Array.isArray(json.data) ? `count=${json.data.length}` : 'no-data');
  } catch (e) { console.error('incidents error', e.message); }
}

function testWebSocket() {
  if (!WebSocket) {
    console.log('ws module not available — skipping WebSocket test');
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const protocol = 'ws';
    const ws = new WebSocket(`${protocol}://localhost:${PORT}`);
    let ok = false;
    ws.on('open', () => { console.log('WebSocket connected'); });
    ws.on('message', (msg) => { try { const m = JSON.parse(msg.toString()); console.log('WS message', m.type || 'message'); ok = true; ws.close(); } catch (e) { } });
    ws.on('close', () => { resolve(ok); });
    setTimeout(() => { if (!ok) { try { ws.terminate(); } catch (e) {} resolve(false); } }, 4000);
  });
}

async function run() {
  console.log('Running smoke tests against', HOST);
  await testOptimize();
  await testOptimizeWithPrediction();
  await testIncidentsList();
  await testPredictions();
  await testEmergencyFlow();
  const wsOk = await testWebSocket();
  console.log('WebSocket OK:', wsOk);
  console.log('Smoke tests complete.');
}

run();

async function testEmergencyFlow() {
  console.log('--- Emergency flow tests ---');
  try {
    const createRes = await fetch(`${HOST}/api/emergencies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'AMBULANCE', severity: 'HIGH', latitude: 21.1458, longitude: 79.0882, destinationLatitude: 21.1492, destinationLongitude: 79.0998, description: 'Smoke test emergency' }) });
    const created = await createRes.json();
    console.log('/api/emergencies POST', createRes.status, created && created.success ? 'OK' : 'FAIL');
    const id = created && created.data && created.data.id;
    if (!id) return;
    const list = await fetch(`${HOST}/api/emergencies`);
    const listJson = await list.json();
    console.log('/api/emergencies GET', list.status, Array.isArray(listJson.data) ? `count=${listJson.data.length}` : 'no-data');

    const routeRes = await fetch(`${HOST}/api/emergencies/${id}/route`, { method: 'POST' });
    const routeJson = await routeRes.json();
    console.log(`/api/emergencies/${id}/route`, routeRes.status, routeJson && routeJson.success ? 'OK' : 'FAIL');

    const unitRes = await fetch(`${HOST}/api/emergencies/${id}/recommend-unit`, { method: 'POST' });
    const unitJson = await unitRes.json();
    console.log(`/api/emergencies/${id}/recommend-unit`, unitRes.status, unitJson && unitJson.success ? 'OK' : 'FAIL');

    const signalsRes = await fetch(`${HOST}/api/emergencies/${id}/signal-priorities`, { method: 'POST' });
    const signalsJson = await signalsRes.json();
    console.log(`/api/emergencies/${id}/signal-priorities`, signalsRes.status, signalsJson && signalsJson.success ? `found:${(signalsJson.data||[]).length}` : 'FAIL');

    const approveRes = await fetch(`${HOST}/api/emergencies/${id}/approve`, { method: 'POST' });
    console.log(`/api/emergencies/${id}/approve`, approveRes.status);

    const resolveRes = await fetch(`${HOST}/api/emergencies/${id}/resolve`, { method: 'POST' });
    console.log(`/api/emergencies/${id}/resolve`, resolveRes.status);

  } catch (e) { console.error('emergency flow error', e.message); }
}
