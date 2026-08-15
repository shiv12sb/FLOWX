let wss = null;

function setSignalWebSocket(serverWss) { wss = serverWss; }

function broadcastSignalUpdate(signalId, payload) {
  try {
    if (!wss) return;
    const message = JSON.stringify({ type: 'signalOptimizationUpdated', signalId, data: payload });
    wss.clients.forEach((c) => { try { if (c.readyState === 1) c.send(message); } catch (e) {} });
  } catch (e) {}
}

module.exports = { setSignalWebSocket, broadcastSignalUpdate };
