(function(){
  let map = null;
  const layers = {};
  let selected = null; // { type, id, data }

  async function initMap(){
    if (map) return map;
    map = L.map('command-map', { zoomControl: true, scrollWheelZoom: true }).setView([21.1458,79.0882], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom: 19 }).addTo(map);
    layers.traffic = L.layerGroup().addTo(map);
    layers.incidents = L.layerGroup().addTo(map);
    layers.predictions = L.layerGroup().addTo(map);
    layers.signals = L.layerGroup().addTo(map);
    layers.emergencies = L.layerGroup().addTo(map);
    layers.routes = L.layerGroup().addTo(map);
    return map;
  }

  // Popup action wiring: handle clicks inside Leaflet popups
  function popupActionHandler(action, type, id) {
    if (action === 'view') {
      // delegate to operator view
      document.getElementById('op-view').click();
    } else if (action === 'optimize') {
      document.getElementById('op-optimize').click();
    } else if (action === 'approve') {
      document.getElementById('op-approve').click();
    } else if (action === 'recommendAssign') {
      // open recommend flow by simulating assign click
      document.querySelector('#operator-panel button[data-op-assign]')?.click();
    }
  }

  map && map.on && map.on('popupopen', (e)=>{
    const el = e.popup.getElement();
    if (!el) return;
    el.querySelectorAll('button[data-cc-action]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        const act = btn.getAttribute('data-cc-action');
        const typ = btn.getAttribute('data-cc-type');
        const id = btn.getAttribute('data-cc-id');
        setSelected({ type: typ, id, data: null });
        popupActionHandler(act, typ, id);
      });
    });
  });

  async function fetchIncidentsMap(){ try{ const res = await fetch('/api/incidents'); if(!res.ok) return []; const j=await res.json(); return j.data||[] }catch(e){return []} }
  async function fetchEmergenciesMap(){ try{ const res = await fetch('/api/emergencies'); if(!res.ok) return []; const j=await res.json(); return j.data||[] }catch(e){return []} }
  async function fetchSignalsMap(){ try{ const res = await fetch('/api/signals'); if(!res.ok) return []; const j=await res.json(); return j.data||[] }catch(e){return []} }

  function clearLayer(name){ if (layers[name]) layers[name].clearLayers(); }
  function setSelected(obj){ selected = obj; const sel = document.getElementById('operator-selected'); sel.textContent = obj ? `${obj.type} ${obj.id}` : 'No selection'; }

  function renderIncidentsOnMap(list){ clearLayer('incidents'); list.forEach(it=>{ if (!it.latitude||!it.longitude) return; const m = L.circleMarker([it.latitude, it.longitude], { radius:8, color: it.severity==='CRITICAL' ? '#b91c1c' : '#f97316' }).addTo(layers.incidents); m.on('click', ()=>{ setSelected({ type:'incident', id:it.id, data:it }); }); m.bindTooltip(`${it.title} (${it.severity})`); }); }
  function renderEmergenciesOnMap(list){ clearLayer('emergencies'); list.forEach(it=>{ if (!it.latitude||!it.longitude) return; const popup = `<div><strong>Emergency</strong><div>${it.type} - ${it.status}</div><div style="margin-top:6px"><button data-cc-action="view" data-cc-type="emergency" data-cc-id="${it.id}">View</button> <button data-cc-action="recommendAssign" data-cc-type="emergency" data-cc-id="${it.id}">Recommend & Assign</button></div></div>`; const m = L.marker([it.latitude, it.longitude], { icon: L.divIcon({ className:'emergency-marker', html:'🚑', iconSize:[24,24] }) }).addTo(layers.emergencies); m.on('click', ()=>{ setSelected({ type:'emergency', id:it.id, data:it }); }); m.bindPopup(popup); m.bindTooltip(`${it.type} (${it.status})`); }); }
  function renderSignalsOnMap(list){ clearLayer('signals'); list.forEach(it=>{ if (!it.latitude||!it.longitude) return; const m = L.circleMarker([it.latitude, it.longitude], { radius:6, color: it.status==='OFFLINE' ? '#6b7280' : '#06b6d4' }).addTo(layers.signals); m.on('click', ()=>{ setSelected({ type:'signal', id:it.id, data:it }); }); m.bindTooltip(`${it.name} (${it.status})`); }); }
  // render incidents popup with actions
  // override incidents rendering to include popup actions
  function renderIncidentsOnMapWithActions(list){ clearLayer('incidents'); list.forEach(it=>{ if (!it.latitude||!it.longitude) return; const popup = `<div><strong>${it.title}</strong><div>${it.type} - ${it.severity}</div><div style="margin-top:6px"><button data-cc-action="view" data-cc-type="incident" data-cc-id="${it.id}">View</button> <button data-cc-action="optimize" data-cc-type="incident" data-cc-id="${it.id}">Optimize Route</button></div></div>`; const m = L.circleMarker([it.latitude, it.longitude], { radius:8, color: it.severity==='CRITICAL' ? '#b91c1c' : '#f97316' }).addTo(layers.incidents); m.bindPopup(popup); m.bindTooltip(`${it.title} (${it.severity})`); m.on('click', ()=> setSelected({ type:'incident', id:it.id, data:it })); }); }
  function renderTrafficGeo(json){ try{ clearLayer('traffic'); if(!json || !json.features) return; json.features.forEach(f=>{ if(!f.geometry || f.geometry.type!=='LineString') return; const coords = f.geometry.coordinates.map(c=>[c[0],c[1]]); const util = f.properties && f.properties.utilization || 0; const color = util>=75? '#dc2626' : util>=45 ? '#f97316' : '#16a34a'; const line = L.polyline(coords, { color, weight: Math.min(8, 2 + Math.round(util/20)) }).addTo(layers.traffic); line.bindTooltip(`<strong>${f.properties.name}</strong><br/>Utilization: ${util}%<br/>Delay: ${f.properties.delay || 0}m`); }); }catch(e){console.warn(e);} }
  function renderPredictionsGeo(json){ try{ clearLayer('predictions'); if(!json || !json.features) return; json.features.forEach(f=>{ if(!f.geometry || f.geometry.type!=='Point') return; const c = f.geometry.coordinates; const m = L.circleMarker([c[0],c[1]], { radius:10, color:'#f43f5e', fillOpacity:0.6 }).addTo(layers.predictions); m.bindTooltip(`Prediction: ${f.properties.id}`); }); }catch(e){console.warn(e);} }

  async function fetchTrafficGeo(){ try{ const res = await fetch('/api/command-center/geo/traffic'); if(!res.ok) return null; const j=await res.json(); return j.data||null }catch(e){return null} }
  async function fetchPredictionsGeo(){ try{ const res = await fetch('/api/command-center/geo/predictions'); if(!res.ok) return null; const j=await res.json(); return j.data||null }catch(e){return null} }

  async function fetchOverview(){
    try{ const res = await fetch('/api/command-center/overview'); if(!res.ok) return null; return await res.json(); }catch(e){return null}
  }
  async function fetchAlerts(){ try{ const res = await fetch('/api/command-center/alerts'); if(!res.ok) return []; const j=await res.json(); return j.data||[] }catch(e){return []} }
  async function fetchRisk(){ try{ const res = await fetch('/api/command-center/risk'); if(!res.ok) return null; const j=await res.json(); return j.data||null }catch(e){return null} }
  async function fetchTimeline(){ try{ const res = await fetch('/api/command-center/timeline'); if(!res.ok) return []; const j=await res.json(); return j.data && j.data.entries ? j.data.entries : [] }catch(e){return []} }
  async function render(){
    await initMap();
    const payload = await fetchOverview();
    if (!payload || !payload.data) { document.getElementById('system-status-value').textContent = 'DEGRADED'; return; }
    const overview = payload.data.overview;
    const recs = payload.data.recommendations || [];
    document.getElementById('kpi-incidents').textContent = overview.incidents.active;
    document.getElementById('kpi-critical-incidents').textContent = overview.incidents.critical;
    document.getElementById('kpi-congested').textContent = overview.roads.congested.length;
    document.getElementById('kpi-emergencies').textContent = overview.emergencies.active;
    document.getElementById('kpi-signals').textContent = overview.signals.attention;
    document.getElementById('kpi-predicted').textContent = overview.roads.predictedHigh.length;
    document.getElementById('system-status-value').textContent = 'OPERATIONAL';
    // risk
    const risk = await fetchRisk();
    if (risk) {
      document.getElementById('risk-value').textContent = `${risk.score} (${risk.category})`;
      document.getElementById('risk-value').style.color = risk.category==='CRITICAL' ? '#b91c1c' : risk.category==='HIGH' ? '#f97316' : risk.category==='MODERATE' ? '#facc15' : '#10b981';
    }

    const dl = document.getElementById('decision-list'); dl.innerHTML = '';
    recs.forEach((r, idx)=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<div><strong>${r.priority}</strong> ${r.title}</div><div style="font-size:0.9em">${r.description}</div><div style="margin-top:6px"><button class="button" data-action="goto" data-target="${r.related}" data-idx="${idx}">Open</button></div>`;
      dl.appendChild(el);
    });

    const alerts = await fetchAlerts();
    const al = document.getElementById('alerts-list'); al.innerHTML = '';
    alerts.slice(0,10).forEach(a=>{ const item=document.createElement('div'); item.className='card'; item.innerHTML = `<div><strong>${a.level}</strong> ${a.message} <div style="font-size:0.8em">${new Date(a.createdAt).toLocaleString()}</div></div>`; al.appendChild(item); });

    // timeline
    const timeline = await fetchTimeline();
    const tl = document.getElementById('command-timeline'); tl.innerHTML = '';
    const filter = document.getElementById('timeline-filter') ? document.getElementById('timeline-filter').value : 'all';
    timeline.forEach(entry => {
      if (filter !== 'all' && entry.type !== filter) return;
      const d = document.createElement('div'); d.style.padding='6px'; d.style.borderBottom='1px solid #eee';
      d.innerHTML = `<div style="font-size:0.9em"><strong>${entry.type.toUpperCase()}</strong> ${entry.text}</div><div style="font-size:0.75em;color:#666">${new Date(entry.time).toLocaleString()}</div>`;
      tl.appendChild(d);
    });
    const tf = document.getElementById('timeline-filter'); if (tf) tf.addEventListener('change', ()=>{ render(); });

    // layer toggles (visual only — integration with existing map engine needed)
    ['traffic','incidents','predictions','signals','emergencies','routes'].forEach(layer => {
      const cb = document.getElementById('layer-' + layer);
      if (cb) {
        cb.addEventListener('change', () => {
          if (!layers[layer]) return;
          if (cb.checked) map.addLayer(layers[layer]); else map.removeLayer(layers[layer]);
        });
      }
    });

    // fetch and render map layers
    const [incidents, emergencies, signals, trafficGeo, predsGeo] = await Promise.all([fetchIncidentsMap(), fetchEmergenciesMap(), fetchSignalsMap(), fetchTrafficGeo(), fetchPredictionsGeo()]);
    renderIncidentsOnMapWithActions(incidents);
    renderEmergenciesOnMap(emergencies);
    renderSignalsOnMap(signals);
    if (trafficGeo) renderTrafficGeo(trafficGeo);
    if (predsGeo) renderPredictionsGeo(predsGeo);

    // operator action handlers for decision list
    // decision list buttons
    document.querySelectorAll('#decision-list button[data-action="goto"]').forEach(b=>{
      b.addEventListener('click', (ev)=>{
        const target = b.getAttribute('data-target');
        if (!target) return;
        // simple routing: open relevant page
        if (target === 'incidents') window.location.href = '/pages/incidents.html' || '/incidents.html';
        else if (target === 'predictions') window.location.href = '/pages/predictions.html' || '/predictions.html';
        else if (target === 'emergencies') window.location.href = '/pages/emergencies.html' || '/emergencies.html';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ render(); setInterval(render, 15000); });
  // operator panel buttons
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('op-view').addEventListener('click', async ()=>{
      if (!selected) return alert('No selection');
      let url = '/api/'+(selected.type==='signal'?'signals':selected.type+'s')+'/'+selected.id;
      try{ const res = await fetch(url); if(!res.ok) return alert('Failed to fetch'); const j=await res.json(); document.getElementById('operator-selected').textContent = JSON.stringify(j.data, null, 2); }catch(e){ alert('Error'); }
    });
    document.getElementById('op-optimize').addEventListener('click', async ()=>{
      if (!selected) return alert('No selection');
      const center = map.getCenter();
      const dest = selected.data && (selected.data.latitude && selected.data.longitude) ? `${selected.data.latitude},${selected.data.longitude}` : null;
      if (!dest) return alert('Selected item has no location');
      try{
        const res = await fetch('/api/routes/optimize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ origin: `${center.lat},${center.lng}`, destination: dest, usePrediction: true })});
        if(!res.ok) return alert('Route optimize failed'); const j=await res.json(); // render recommended route if present
        if (j.data && j.data.recommendedRoute && j.data.recommendedRoute.points) {
          clearLayer('routes');
          const pts = j.data.recommendedRoute.points.map(p=>[p[0],p[1]]);
          L.polyline(pts, { color:'#2563eb', weight:4 }).addTo(layers.routes);
          map.fitBounds(L.latLngBounds(pts), { padding:[20,20] });
        }
      }catch(e){ alert('Error optimizing route'); }
    });
    document.getElementById('op-approve').addEventListener('click', async ()=>{
      if (!selected) return alert('No selection');
      try{
        if (selected.type === 'signal') {
          const res = await fetch('/api/signals/'+selected.id+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ plan: selected.data.plan||{} })});
          if(!res.ok) return alert('Approve failed'); alert('Approved');
        } else if (selected.type === 'emergency') {
          const res = await fetch('/api/emergencies/'+selected.id+'/approve',{method:'POST'});
          if(!res.ok) return alert('Approve failed'); alert('Emergency approved');
        } else {
          alert('Approve not supported for this selection');
        }
      }catch(e){ alert('Error approving'); }
    });
    // recommend unit / assign
    const assignBtn = document.createElement('button'); assignBtn.textContent='Recommend & Assign'; assignBtn.className='button';
    assignBtn.addEventListener('click', async ()=>{
      if (!selected || selected.type !== 'emergency') return alert('Select an emergency');
      try{
        const r = await fetch('/api/emergencies/'+selected.id+'/recommend-unit',{method:'POST'});
        if(!r.ok) return alert('Recommend failed'); const jr=await r.json(); const rec = jr.data;
        if (!rec) return alert('No unit recommended');
        if (!confirm(`Assign unit ${rec.unitId || rec.unit && rec.unit.unitNumber}?`)) return;
        const a = await fetch('/api/emergencies/'+selected.id+'/assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ unitId: rec.unitId || (rec.unit && rec.unit.id) })});
        if(!a.ok) return alert('Assign failed'); alert('Unit assigned');
      }catch(e){ alert('Error assigning unit'); }
    });
    const opPanel = document.getElementById('operator-panel'); if (opPanel && !opPanel.querySelector('[data-op-assign]')) { assignBtn.setAttribute('data-op-assign','1'); opPanel.appendChild(assignBtn); }
  });
})();
