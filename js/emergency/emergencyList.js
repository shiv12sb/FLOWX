// Emergency list client with realtime updates and operator actions
async function fetchEmergencies() {
  const res = await fetch('/api/emergencies', { headers: { 'Authorization': 'Bearer ' + (localStorage.authToken||'') } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

async function postAction(path, body = {}) {
  const token = localStorage.authToken || '';
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: Object.keys(body).length ? JSON.stringify(body) : undefined });
  try { return await res.json(); } catch (e) { return null; }
}

function renderEmergencies(list) {
  const el = document.getElementById('emergency-list');
  if (!el) return;
  el.innerHTML = '';
  list.forEach(e => {
    const item = document.createElement('div');
    item.className = 'emergency-item card';
    item.innerHTML = `
      <div class="card__header"><strong>${e.type} · ${e.severity}</strong><span style="float:right">${e.status}</span></div>
      <div class="card__body">
        <div>ID: <strong>${e.id}</strong></div>
        <div>Location: ${e.latitude || '—'}, ${e.longitude || '—'}</div>
        <div>Destination: ${e.destinationLatitude ? e.destinationLatitude + ',' + e.destinationLongitude : '—'}</div>
        <div>Assigned Unit: ${e.assignedUnitId || 'Unassigned'}</div>
        <div style="margin-top:8px">
          <button data-action="recommend-unit" data-id="${e.id}" class="button">Recommend Unit</button>
          <button data-action="recommend-route" data-id="${e.id}" class="button">Recommend Route</button>
          <button data-action="approve" data-id="${e.id}" class="button">Approve</button>
          <button data-action="resolve" data-id="${e.id}" class="button">Resolve</button>
        </div>
      </div>
    `;
    el.appendChild(item);
  });

  // attach handlers
  el.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      try {
        if (action === 'recommend-unit') {
          await postAction(`/api/emergencies/${id}/recommend-unit`);
        } else if (action === 'recommend-route') {
          await postAction(`/api/emergencies/${id}/route`);
        } else if (action === 'approve') {
          await postAction(`/api/emergencies/${id}/approve`);
        } else if (action === 'resolve') {
          await postAction(`/api/emergencies/${id}/resolve`);
        }
      } catch (e) { /* ignore */ }
      btn.disabled = false;
      // refresh list after action
      const list = await fetchEmergencies(); renderEmergencies(list); updateCounts(list);
    });
  });
}

function updateCounts(list) {
  const el = document.getElementById('active-count');
  if (!el) return;
  el.textContent = String(list.filter(i => i.status && i.status !== 'RESOLVED' && i.status !== 'CANCELLED').length);
}

function setupRealtime() {
  try {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}`);
    ws.addEventListener('message', async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type && msg.type.startsWith('emergency.')) {
          // refresh list and update counts
          const list = await fetchEmergencies();
          renderEmergencies(list);
          updateCounts(list);
          // if simulation engine present, push events into it
          if (window.FlowXEmergency && typeof window.FlowXEmergency.state !== 'undefined') {
            // on created: add a simulated vehicle for operator preview
            if (msg.type === 'emergency.created' && msg.data) {
              // create a simulation vehicle from server data
              const vehicle = window.FlowXEmergency.createEmergencyVehicle ? window.FlowXEmergency.createEmergencyVehicle({ vehicleType: msg.data.type || 'AMBULANCE', origin: msg.data.latitude && msg.data.longitude ? `${msg.data.latitude},${msg.data.longitude}` : 'Central Square', destination: msg.data.destinationLatitude && msg.data.destinationLongitude ? `${msg.data.destinationLatitude},${msg.data.destinationLongitude}` : 'City Hospital' }) : null;
              if (vehicle) { window.FlowXEmergency.state.activeEmergencies.unshift(vehicle); window.FlowXEmergency.state.selectedVehicleId = vehicle.id; }
            }
            if (msg.type === 'emergency.assigned' && msg.data && msg.data.emergency) {
              // mark assigned in simulation state if exists
              const id = msg.data.emergency.id;
              const veh = window.FlowXEmergency.state.activeEmergencies.find(v=>v.id===id);
              if (veh) veh.assignedUnit = msg.data.unit || null;
            }
          }
        }
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }
}

window.loadEmergencies = async function() { const list = await fetchEmergencies(); renderEmergencies(list); updateCounts(list); };
window.setupEmergencyRealtime = setupRealtime;

// auto-setup after load
document.addEventListener('DOMContentLoaded', () => { setupRealtime(); });
