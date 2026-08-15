(function(){
  let map, layerGroup;
  const coords = {
    'ring-road': [[21.1752,79.0587],[21.1431,79.0824]],
    'wardha-road': [[21.1479,79.0718],[21.1396,79.1062]],
    'central-avenue': [[21.1546,79.0919],[21.1275,79.1119]],
    'sadar-nagpur': [[21.1339,79.0718],[21.1468,79.1162]],
    'cotton-market': [[21.1609,79.1091],[21.1419,79.0986]],
    'airport-corridor': [[21.1124,79.0469],[21.1396,79.0703]]
  };

  function getColor(val){ return val>=85?'#b91c1c':val>=65?'#f97316':val>=40?'#facc15':'#10b981'; }

  function init(){
    if (!document.getElementById('prediction-map')) return;
    map = L.map('prediction-map').setView([21.1458,79.0882],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    layerGroup = L.layerGroup().addTo(map);
  }

  function render(networkData, mode){
    if (!map) init();
    layerGroup.clearLayers();
    const horizon = mode==='live'?'+15':mode;
    Object.keys(networkData||{}).forEach((roadId)=>{
      const entry = networkData[roadId];
      const val = entry?.[horizon]?.predictedTrafficLevel || 0;
      const lineCoords = coords[roadId] || [];
      if (!lineCoords.length) return;
      const poly = L.polyline(lineCoords, { color: getColor(val), weight: 8, opacity: 0.8 }).addTo(layerGroup);
      poly.bindPopup(`<strong>${roadId}</strong><br>Predicted: ${val}%<br>Horizon: ${horizon}`);
    });
  }

  window.PredictionMap = { render };
})();
