let wss = null;

function setPredictionWebSocket(serverWss) { wss = serverWss; }

function broadcastPrediction(roadId, payload) {
  try {
    if (!wss) return;
    const message = JSON.stringify({ type: 'trafficPredictionUpdated', roadId, data: payload });
    wss.clients.forEach((c) => { try { if (c.readyState === 1) c.send(message); } catch (e) {} });
  } catch (e) {}
}

module.exports = { setPredictionWebSocket, broadcastPrediction };
