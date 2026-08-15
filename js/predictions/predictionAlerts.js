(function(){
  function render(networkData, mode){
    const container = document.getElementById('prediction-insights');
    if (!container) return;
    container.innerHTML = '';
    const horizon = mode==='live'?'+15':mode;
    const alerts = [];
    Object.entries(networkData||{}).forEach(([roadId, pred])=>{
      const val = pred?.[horizon]?.predictedTrafficLevel || 0;
      if (val >= 85) {
        alerts.push({ roadId, val, text: `Severe congestion expected on ${roadId} within ${horizon.replace('+','')}` });
      } else if (val >= 65) {
        alerts.push({ roadId, val, text: `High congestion likely on ${roadId} (${val}%)` });
      }
    });
    if (!alerts.length) { container.innerHTML = '<div>No predicted alerts.</div>'; return; }
    container.innerHTML = alerts.map(a=>`<div class="card"><div class="card__body"><strong>${a.text}</strong><div>Predicted: ${a.val}%</div></div></div>`).join('');
  }

  window.PredictionAlerts = { render };
})();
