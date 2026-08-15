(function () {
  const apiBase = '/api/incidents';
  let map = null;
  let markers = {};

  function initMap() {
    if (!document.getElementById('incident-map')) return;
    map = L.map('incident-map').setView([21.1458, 79.0882], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  }

  function severityColor(sev) {
    if (!sev) return '#999';
    if (sev === 'CRITICAL') return '#b91c1c';
    if (sev === 'HIGH') return '#f97316';
    if (sev === 'MEDIUM') return '#facc15';
    return '#10b981';
  }

  function renderIncidents(list) {
    const container = document.getElementById('incidents-list');
    if (!container) return;
    container.innerHTML = list.map((inc) => `
      <div class="incident-item card" data-id="${inc.id}">
        <div class="card__header"><strong>${inc.title}</strong> <span style="float:right">${inc.severity}</span></div>
        <div class="card__body">
          <p>${inc.description || ''}</p>
          <p><small>${inc.type} · ${inc.status} · Reported: ${new Date(inc.reportedAt).toLocaleString()}</small></p>
        </div>
      </div>
    `).join('');

    // update markers
    if (map) {
      Object.values(markers).forEach((m) => map.removeLayer(m));
      markers = {};
      list.forEach((inc) => {
        if (inc.latitude && inc.longitude) {
          const m = L.circleMarker([inc.latitude, inc.longitude], { radius: 8, color: severityColor(inc.severity), fillOpacity: 0.9 }).addTo(map);
          m.bindPopup(`<strong>${inc.title}</strong><br>${inc.type}<br>${inc.status}`);
          markers[inc.id] = m;
        }
      });
    }
  }

  async function fetchIncidents() {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return [];
      const payload = await res.json();
      return payload.data || [];
    } catch (e) { return []; }
  }

  async function fetchAnalytics() {
    try {
      const res = await fetch(apiBase + '/analytics');
      if (!res.ok) return null;
      const p = await res.json();
      return p.data || null;
    } catch (e) { return null; }
  }

  function renderAnalytics(a) {
    const el = document.getElementById('incidents-analytics');
    if (!el) return;
    if (!a) { el.innerHTML = '<div class="card__body">No analytics available.</div>'; return; }
    el.innerHTML = `
      <div class="card">
        <div class="card__header"><div class="card__title">Incident Analytics</div></div>
        <div class="card__body">
          <div><strong>Incidents Today:</strong> ${a.incidentsToday}</div>
          <div><strong>Avg Resolution (min):</strong> ${a.averageResolutionMinutes}</div>
          <div><strong>Most Affected Road:</strong> ${a.mostAffectedRoad || '—'}</div>
          <div><strong>Most Common Type:</strong> ${a.mostCommonType || '—'}</div>
          <div><strong>Critical Active:</strong> ${a.criticalIncidents}</div>
        </div>
      </div>
    `;
  }

  function setupRealtime() {
    try {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${protocol}://${location.host}`;
      const ws = new WebSocket(url);
      ws.addEventListener('message', async (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type && msg.type.startsWith('incident.')) {
            const list = await fetchIncidents();
            renderIncidents(list);
            const analytics = await fetchAnalytics();
            renderAnalytics(analytics);
            // apply to simulation engine if available
            list.forEach((inc) => {
              if (window.FlowXTrafficEngine && inc.road && inc.status === 'ACTIVE') {
                window.FlowXTrafficEngine.addIncident(inc.road, inc.type.toLowerCase());
              }
            });
          }
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    const list = await fetchIncidents();
    renderIncidents(list);
    renderAnalytics(await fetchAnalytics());
    document.getElementById('refresh-incidents')?.addEventListener('click', async () => { renderIncidents(await fetchIncidents()); });
    setupRealtime();
    // report modal
    const openBtn = document.getElementById('open-report');
    const modal = document.getElementById('report-modal');
    openBtn?.addEventListener('click', () => { modal.style.display = 'block'; modal.setAttribute('aria-hidden', 'false'); });
    document.getElementById('close-report')?.addEventListener('click', () => { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); });
    document.getElementById('submit-report')?.addEventListener('click', async () => {
      const payload = {
        title: document.getElementById('report-title').value,
        description: document.getElementById('report-desc').value,
        type: document.getElementById('report-type').value,
        severity: document.getElementById('report-severity').value,
        road: document.getElementById('report-road').value,
        latitude: parseFloat(document.getElementById('report-lat').value) || null,
        longitude: parseFloat(document.getElementById('report-lon').value) || null,
        source: 'web'
      };
      const token = localStorage.getItem('authToken');
      if (!token) { alert('You must be logged in to report incidents.'); return; }
      try {
        const res = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        if (res.ok) {
          modal.style.display = 'none';
          renderIncidents(await fetchIncidents());
          renderAnalytics(await fetchAnalytics());
        } else {
          const p = await res.json(); alert('Failed: ' + (p.message || 'error'));
        }
      } catch (e) { alert('Request failed'); }
    });
  });
})();
