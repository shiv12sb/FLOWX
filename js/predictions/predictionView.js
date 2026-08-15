(function(){
  const api = '/api/predictions';
  let mode = '+15';
  document.addEventListener('DOMContentLoaded', async ()=>{
    document.getElementById('mode-live').addEventListener('click', ()=>{ mode='live'; updateAll(); });
    document.getElementById('mode-15').addEventListener('click', ()=>{ mode='+15'; updateAll(); });
    document.getElementById('mode-30').addEventListener('click', ()=>{ mode='+30'; updateAll(); });
    document.getElementById('mode-60').addEventListener('click', ()=>{ mode='+60'; updateAll(); });
    await updateAll();
    setupRealtime();
  });

  async function fetchNetwork(){
    const res = await fetch(api + '/network');
    if (!res.ok) return null; const p = await res.json(); return p.data;
  }

  async function updateAll(){
    const data = await fetchNetwork();
    if (!data) return;
    // render chart
    window.PredictionChart?.render(data, mode);
    // map
    window.PredictionMap?.render(data, mode);
    // insights
    window.PredictionAlerts?.render(data, mode);
  }

  function setupRealtime(){
    try {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${location.host}`);
      ws.addEventListener('message', async (evt)=>{
        try{
          const msg = JSON.parse(evt.data);
          if (msg.type === 'trafficPredictionUpdated') {
            // minor: re-fetch and update
            await updateAll();
          }
        }catch(e){}
      });
    }catch(e){}
  }
})();
