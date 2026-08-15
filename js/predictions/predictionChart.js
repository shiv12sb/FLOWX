(function(){
  function render(networkData, mode){
    const container = document.getElementById('prediction-chart');
    if (!container) return;
    // simple summary: compute network average for selected horizon
    const horizon = mode === 'live' ? '+15' : mode;
    const roads = Object.keys(networkData || {});
    if (!roads.length) { container.innerHTML = '<div class="route-empty">No prediction data.</div>'; return; }
    const values = roads.map(r=> networkData[r] ? (networkData[r][horizon]?.predictedTrafficLevel || 0) : 0);
    const avg = Math.round(values.reduce((s,v)=>s+v,0)/values.length);
    container.innerHTML = '';
    const bar = document.createElement('div');
    bar.style.height = '36px';
    bar.style.background = '#e6f4ff';
    bar.style.borderRadius = '6px';
    bar.style.position = 'relative';
    const fill = document.createElement('div');
    fill.style.width = Math.min(100, avg) + '%';
    fill.style.height = '100%';
    fill.style.background = avg >= 85 ? '#b91c1c' : avg >=65 ? '#f97316' : avg >=40 ? '#facc15' : '#10b981';
    fill.style.borderRadius = '6px';
    bar.appendChild(fill);
    const label = document.createElement('div');
    label.style.position='absolute'; label.style.left='8px'; label.style.top='6px'; label.style.fontWeight='600';
    label.textContent = `Network predicted congestion (${horizon}): ${avg}%`;
    bar.appendChild(label);
    container.appendChild(bar);
  }

  window.PredictionChart = { render };
})();
